from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, TypedDict

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st
import yfinance as yf
from langgraph.graph import END, StateGraph

SUPPORTED_ASSETS = ["BTC-USD", "ETH-USD", "SPY", "QQQ", "AAPL", "TSLA"]
JOURNAL_DB = "trade_journal.db"


class TradeState(TypedDict, total=False):
    symbol: str
    timeframe: str
    account_size: float
    model_name: str
    data: pd.DataFrame
    metrics: Dict[str, Any]
    signal_context: Dict[str, Any]
    risk_context: Dict[str, Any]
    decision: Dict[str, Any]
    in_position: bool


@dataclass
class OllamaClient:
    model: str = "llama3"
    base_url: str = "http://localhost:11434/api/generate"

    def explain(self, decision: Dict[str, Any], context: Dict[str, Any]) -> List[str]:
        prompt = (
            "You are TradeFlow AI. Keep output concise and conservative. "
            "Rewrite these reasons as 3 short bullet-ready lines. "
            "Do not invent prices.\n"
            f"Decision: {json.dumps(decision)}\n"
            f"Context: {json.dumps(context, default=str)}\n"
            "Return JSON array with exactly 3 strings."
        )
        try:
            resp = requests.post(
                self.base_url,
                json={"model": self.model, "prompt": prompt, "stream": False, "options": {"temperature": 0}},
                timeout=20,
            )
            resp.raise_for_status()
            text = resp.json().get("response", "[]")
            parsed = json.loads(text)
            if isinstance(parsed, list) and len(parsed) == 3:
                return [str(x) for x in parsed]
        except Exception:
            pass
        return decision["reasons"]


def sma(series: pd.Series, length: int) -> pd.Series:
    return series.rolling(length).mean()


def rsi(series: pd.Series, length: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / length, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / length, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    hist = macd_line - signal_line
    return pd.DataFrame({"MACD": macd_line, "MACD_SIGNAL": signal_line, "MACD_HIST": hist})


def atr(df: pd.DataFrame, length: int = 14) -> pd.Series:
    prev_close = df["Close"].shift(1)
    tr = pd.concat(
        [
            (df["High"] - df["Low"]).abs(),
            (df["High"] - prev_close).abs(),
            (df["Low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1 / length, adjust=False).mean()


def ensure_journal() -> None:
    with sqlite3.connect(JOURNAL_DB) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS trade_journal (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                symbol TEXT NOT NULL,
                action TEXT NOT NULL,
                confidence REAL NOT NULL,
                entry REAL NOT NULL,
                stop REAL NOT NULL,
                target REAL NOT NULL,
                reasons TEXT NOT NULL
            )
            """
        )


def fetch_recent_position(symbol: str) -> bool:
    with sqlite3.connect(JOURNAL_DB) as conn:
        row = conn.execute(
            "SELECT action FROM trade_journal WHERE symbol = ? ORDER BY id DESC LIMIT 1", (symbol,)
        ).fetchone()
    return bool(row and row[0] == "BUY")


def save_decision(decision: Dict[str, Any]) -> None:
    with sqlite3.connect(JOURNAL_DB) as conn:
        conn.execute(
            """
            INSERT INTO trade_journal(timestamp, symbol, action, confidence, entry, stop, target, reasons)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                decision["symbol"],
                decision["action"],
                float(decision["confidence"]),
                float(decision["entry"]),
                float(decision["stop_loss"]),
                float(decision["target"]),
                " | ".join(decision["reasons"]),
            ),
        )


def load_market_data_node(state: TradeState) -> TradeState:
    symbol = state["symbol"]
    tf = state.get("timeframe", "1d")
    df = yf.download(symbol, period="90d", interval=tf, auto_adjust=False, progress=False)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
    df = df[df["Volume"] > 0]

    if df.empty or len(df) < 60:
        state["metrics"] = {"error": "insufficient_data"}
        state["data"] = df
        return state

    latest = df.iloc[-1]
    state["data"] = df
    state["metrics"] = {
        "latest_price": float(latest["Close"]),
        "latest_volume": float(latest["Volume"]),
        "trend_20": float(df["Close"].tail(20).pct_change().mean()),
    }
    return state


def indicator_node(state: TradeState) -> TradeState:
    df = state.get("data", pd.DataFrame()).copy()
    if df.empty:
        return state

    df["SMA20"] = sma(df["Close"], 20)
    df["SMA50"] = sma(df["Close"], 50)
    df["RSI14"] = rsi(df["Close"], 14)
    macd_df = macd(df["Close"], 12, 26, 9)
    df = pd.concat([df, macd_df], axis=1)
    df["ATR14"] = atr(df, 14)
    df["RET"] = df["Close"].pct_change()
    df["VOLATILITY"] = df["RET"].rolling(20).std()

    state["data"] = df.dropna().copy()
    return state


def signal_node(state: TradeState) -> TradeState:
    df = state.get("data", pd.DataFrame())
    metrics = state.get("metrics", {})
    if df.empty or metrics.get("error"):
        state["signal_context"] = {
            "action_hint": "NO TRADE",
            "confidence": 0.0,
            "reasons": ["Insufficient market data.", "Cannot compute reliable indicators.", "Capital preservation first."],
        }
        return state

    latest = df.iloc[-1]
    prev = df.iloc[-2]

    macd_bull = bool(prev["MACD"] <= prev["MACD_SIGNAL"] and latest["MACD"] > latest["MACD_SIGNAL"])
    macd_bear = bool(prev["MACD"] >= prev["MACD_SIGNAL"] and latest["MACD"] < latest["MACD_SIGNAL"])

    buy_setup = bool(
        latest["Close"] > latest["SMA20"] > latest["SMA50"]
        and 45 <= latest["RSI14"] <= 68
        and macd_bull
    )
    sell_setup = bool(
        latest["Close"] < latest["SMA20"] < latest["SMA50"]
        and latest["RSI14"] < 45
        and macd_bear
    )

    vol_mean_20 = float(df["Volume"].tail(20).mean())
    low_volume = bool(latest["Volume"] < (0.7 * vol_mean_20))

    vol_now = float(latest["VOLATILITY"])
    vol_thr = float(df["VOLATILITY"].quantile(0.90))
    vol_extreme = bool(vol_now > vol_thr)

    in_position = state.get("in_position", False)

    reasons: List[str] = []
    action: Literal["BUY", "SELL", "HOLD", "NO TRADE"] = "NO TRADE"
    confidence = 0.5

    if low_volume or vol_extreme:
        action = "NO TRADE"
        reasons.append("Market quality filter triggered (low volume or extreme volatility).")
        confidence -= 0.15
    elif buy_setup and not sell_setup:
        action = "BUY"
        reasons.append("Trend alignment bullish: Price > SMA20 > SMA50.")
        reasons.append("Momentum supportive: RSI in balanced bullish zone and MACD bullish crossover.")
        confidence += 0.25
    elif sell_setup and not buy_setup:
        action = "SELL"
        reasons.append("Trend alignment bearish: Price < SMA20 < SMA50.")
        reasons.append("Momentum weak: RSI below 45 and MACD bearish crossover.")
        confidence += 0.25
    elif in_position:
        action = "HOLD"
        reasons.append("Existing paper position with no exit trigger.")
        confidence += 0.05
    else:
        action = "NO TRADE"
        reasons.append("Signals are conflicting or incomplete.")
        confidence -= 0.05

    reasons.append(f"Volatility(20d std): {vol_now:.4f}; Volume vs 20d mean: {latest['Volume']/vol_mean_20:.2f}x.")

    state["signal_context"] = {
        "action_hint": action,
        "confidence": float(np.clip(confidence, 0, 1)),
        "reasons": reasons[:3],
        "atr": float(latest["ATR14"]),
        "entry": float(latest["Close"]),
    }
    return state


def risk_node(state: TradeState) -> TradeState:
    sctx = state.get("signal_context", {})
    action = sctx.get("action_hint", "NO TRADE")
    confidence = float(sctx.get("confidence", 0.0))
    entry = float(sctx.get("entry", 0.0))
    atr_v = float(sctx.get("atr", 0.0))

    risk_per_trade = float(state.get("account_size", 10000.0)) * 0.01
    stop_distance = 1.5 * atr_v

    if action == "BUY":
        stop = entry - stop_distance
        target = entry + (2.0 * stop_distance)
    elif action == "SELL":
        stop = entry + stop_distance
        target = entry - (2.0 * stop_distance)
    else:
        stop = 0.0
        target = 0.0

    if confidence < 0.60:
        action = "NO TRADE"

    rr = 0.0
    if action in {"BUY", "SELL"} and stop_distance > 0:
        rr = abs((target - entry) / (entry - stop))

    state["risk_context"] = {
        "risk_per_trade": risk_per_trade,
        "action": action,
        "stop": float(stop),
        "target": float(target),
        "risk_reward": float(rr),
    }
    return state


def decision_node(state: TradeState) -> TradeState:
    sctx = state.get("signal_context", {})
    rctx = state.get("risk_context", {})

    decision = {
        "symbol": state.get("symbol", ""),
        "action": rctx.get("action", "NO TRADE"),
        "confidence": round(float(sctx.get("confidence", 0.0)), 2),
        "entry": round(float(sctx.get("entry", 0.0)), 2),
        "stop_loss": round(float(rctx.get("stop", 0.0)), 2),
        "target": round(float(rctx.get("target", 0.0)), 2),
        "risk_reward": round(float(rctx.get("risk_reward", 0.0)), 2),
        "reasons": sctx.get(
            "reasons",
            ["Insufficient data.", "No robust setup found.", "Capital preservation first."],
        )[:3],
    }

    model = state.get("model_name", "llama3")
    decision["reasons"] = OllamaClient(model=model).explain(decision, {"signal": sctx, "risk": rctx})
    state["decision"] = decision
    return state


def journal_node(state: TradeState) -> TradeState:
    decision = state.get("decision", {})
    if decision:
        save_decision(decision)
    return state


def build_workflow():
    graph = StateGraph(TradeState)
    graph.add_node("market_data", load_market_data_node)
    graph.add_node("indicator", indicator_node)
    graph.add_node("signal", signal_node)
    graph.add_node("risk", risk_node)
    graph.add_node("decision", decision_node)
    graph.add_node("journal", journal_node)

    graph.set_entry_point("market_data")
    graph.add_edge("market_data", "indicator")
    graph.add_edge("indicator", "signal")
    graph.add_edge("signal", "risk")
    graph.add_edge("risk", "decision")
    graph.add_edge("decision", "journal")
    graph.add_edge("journal", END)
    return graph.compile()


def load_journal_table() -> pd.DataFrame:
    with sqlite3.connect(JOURNAL_DB) as conn:
        try:
            return pd.read_sql_query("SELECT * FROM trade_journal ORDER BY id DESC LIMIT 50", conn)
        except Exception:
            return pd.DataFrame()


def render_chart(df: pd.DataFrame, symbol: str) -> None:
    fig = go.Figure(
        data=[
            go.Candlestick(
                x=df.index,
                open=df["Open"],
                high=df["High"],
                low=df["Low"],
                close=df["Close"],
                name=symbol,
            ),
            go.Scatter(x=df.index, y=df["SMA20"], name="SMA20", line=dict(width=1.5)),
            go.Scatter(x=df.index, y=df["SMA50"], name="SMA50", line=dict(width=1.5)),
        ]
    )
    fig.update_layout(height=520, xaxis_rangeslider_visible=False, template="plotly_dark")
    st.plotly_chart(fig, use_container_width=True)


def run_analysis(symbol: str, timeframe: str, model_name: str, account_size: float = 10000.0) -> TradeState:
    workflow = build_workflow()
    init_state: TradeState = {
        "symbol": symbol,
        "timeframe": timeframe,
        "account_size": account_size,
        "model_name": model_name,
        "in_position": fetch_recent_position(symbol),
    }
    return workflow.invoke(init_state)


def main() -> None:
    st.set_page_config(page_title="TradeFlow AI - Day 1 MVP", layout="wide")
    ensure_journal()

    st.title("TradeFlow AI — Day 1 MVP (Paper Trading)")
    st.caption("Educational tool only. Not financial advice. Capital preservation first.")

    with st.sidebar:
        symbol = st.selectbox("Ticker", SUPPORTED_ASSETS, index=0)
        timeframe = st.selectbox("Timeframe", ["1d"], index=0)
        model_name = st.selectbox("Ollama model", ["llama3", "mistral", "qwen2.5", "deepseek-r1"], index=0)
        run = st.button("Run analysis", type="primary")

    if run:
        state = run_analysis(symbol, timeframe, model_name)
        decision = state.get("decision", {})
        df = state.get("data", pd.DataFrame())

        if not df.empty:
            render_chart(df.tail(120), symbol)

        col1, col2 = st.columns([1, 1])
        with col1:
            st.subheader("Indicators summary")
            if not df.empty:
                latest = df.iloc[-1]
                st.json(
                    {
                        "Close": round(float(latest["Close"]), 2),
                        "SMA20": round(float(latest["SMA20"]), 2),
                        "SMA50": round(float(latest["SMA50"]), 2),
                        "RSI14": round(float(latest["RSI14"]), 2),
                        "ATR14": round(float(latest["ATR14"]), 2),
                    }
                )

        with col2:
            st.subheader("Final signal")
            st.json(decision)
            st.markdown("**Reasoning**")
            for r in decision.get("reasons", []):
                st.markdown(f"- {r}")

    st.subheader("Trade journal")
    st.dataframe(load_journal_table(), use_container_width=True)


if __name__ == "__main__":
    main()
