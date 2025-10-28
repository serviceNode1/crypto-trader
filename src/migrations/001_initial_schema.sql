--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17
-- Dumped by pg_dump version 14.17

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: expire_old_approvals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_old_approvals() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE trade_approvals
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.recommendations (
    id integer NOT NULL,
    symbol character varying(20) NOT NULL,
    action character varying(4) NOT NULL,
    confidence numeric(5,2) NOT NULL,
    entry_price numeric(20,8),
    stop_loss numeric(20,8),
    take_profit_1 numeric(20,8),
    take_profit_2 numeric(20,8),
    position_size numeric(5,4),
    risk_level character varying(10),
    reasoning jsonb,
    sources text[],
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    execution_status character varying(20) DEFAULT 'pending'::character varying,
    executed_at timestamp without time zone,
    user_id integer NOT NULL,
    CONSTRAINT recommendations_action_check CHECK (((action)::text = ANY ((ARRAY['BUY'::character varying, 'SELL'::character varying, 'HOLD'::character varying])::text[]))),
    CONSTRAINT recommendations_execution_status_check CHECK (((execution_status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying, 'executed'::character varying, 'rejected'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT recommendations_risk_level_check CHECK (((risk_level)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying])::text[])))
,
    PRIMARY KEY (id));


-- Name: trade_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.trade_approvals (
    id integer NOT NULL,
    recommendation_id integer,
    symbol character varying(10) NOT NULL,
    action character varying(10) NOT NULL,
    quantity numeric(20,8) NOT NULL,
    entry_price numeric(20,8) NOT NULL,
    stop_loss numeric(20,8),
    take_profit_1 numeric(20,8),
    take_profit_2 numeric(20,8),
    reasoning text,
    status character varying(20) DEFAULT 'pending'::character varying,
    approved_at timestamp without time zone,
    rejected_at timestamp without time zone,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone DEFAULT (now() + '01:00:00'::interval),
    CONSTRAINT trade_approvals_action_check CHECK (((action)::text = ANY ((ARRAY['BUY'::character varying, 'SELL'::character varying])::text[]))),
    CONSTRAINT trade_approvals_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'expired'::character varying, 'executed'::character varying])::text[])))
,
    PRIMARY KEY (id));


--
-- Name: TABLE trade_approvals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.trade_approvals IS 'Queue for trades requiring manual approval';


--
-- Name: COLUMN trade_approvals.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_approvals.status IS 'pending | approved | rejected | expired | executed';


--
-- Name: active_approvals; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.active_approvals AS
 SELECT ta.id,
    ta.recommendation_id,
    ta.symbol,
    ta.action,
    ta.quantity,
    ta.entry_price,
    ta.stop_loss,
    ta.take_profit_1,
    ta.take_profit_2,
    ta.reasoning,
    ta.status,
    ta.approved_at,
    ta.rejected_at,
    ta.rejection_reason,
    ta.created_at,
    ta.expires_at,
    r.confidence,
    r.risk_level,
    ((ta.expires_at)::timestamp with time zone - now()) AS time_remaining
   FROM (public.trade_approvals ta
     LEFT JOIN public.recommendations r ON ((ta.recommendation_id = r.id)))
  WHERE (((ta.status)::text = 'pending'::text) AND (ta.expires_at > now()))
  ORDER BY ta.created_at DESC;


--
-- Name: ai_review_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.ai_review_logs (
    id integer NOT NULL,
    review_type character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    status character varying(20) NOT NULL,
    phase character varying(50),
    coins_analyzed integer,
    buy_recommendations integer DEFAULT 0,
    sell_recommendations integer DEFAULT 0,
    skipped_opportunities integer DEFAULT 0,
    error_message text,
    metadata jsonb,
    duration integer,
    "timestamp" timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    user_id integer
,
    PRIMARY KEY (id));


--
-- Name: ai_review_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.ai_review_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_review_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_review_logs_id_seq OWNED BY public.ai_review_logs.id;


--
-- Name: altcoin_discoveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.altcoin_discoveries (
    id integer NOT NULL,
    symbol character varying(20) NOT NULL,
    name character varying(100),
    market_cap numeric(20,2),
    volume_24h numeric(20,2),
    price numeric(20,8),
    sentiment_score numeric(5,4),
    technical_score numeric(5,4),
    total_score numeric(5,4),
    rank integer,
    exchanges text[],
    discovered_at timestamp with time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: altcoin_discoveries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.altcoin_discoveries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: altcoin_discoveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.altcoin_discoveries_id_seq OWNED BY public.altcoin_discoveries.id;


--
-- Name: api_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.api_usage (
    id integer NOT NULL,
    api_name character varying(50) NOT NULL,
    endpoint character varying(200),
    requests_count integer DEFAULT 1,
    success_count integer DEFAULT 0,
    error_count integer DEFAULT 0,
    total_latency_ms integer DEFAULT 0,
    date date DEFAULT CURRENT_DATE NOT NULL
,
    PRIMARY KEY (id));


--
-- Name: api_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.api_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: api_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.api_usage_id_seq OWNED BY public.api_usage.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.audit_log (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    resource_type character varying(50),
    resource_id integer,
    details jsonb,
    ip_address character varying(45),
    user_agent text,
    success boolean DEFAULT true,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: circuit_breakers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.circuit_breakers (
    id integer NOT NULL,
    trigger_type character varying(50) NOT NULL,
    trigger_value numeric(10,2),
    threshold numeric(10,2),
    status character varying(20) DEFAULT 'active'::character varying,
    trades_blocked integer DEFAULT 0,
    duration_minutes integer,
    resolved_at timestamp without time zone,
    resolved_by character varying(50),
    resolution_notes text,
    triggered_at timestamp without time zone DEFAULT now(),
    CONSTRAINT circuit_breakers_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'resolved'::character varying, 'manual_override'::character varying])::text[])))
,
    PRIMARY KEY (id));


--
-- Name: TABLE circuit_breakers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.circuit_breakers IS 'Trading halt events for safety';


--
-- Name: circuit_breakers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.circuit_breakers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: circuit_breakers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.circuit_breakers_id_seq OWNED BY public.circuit_breakers.id;


--
-- Name: coin_id_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.coin_id_mappings (
    symbol character varying(20) NOT NULL,
    coin_id character varying(100) NOT NULL,
    discovered_at timestamp without time zone DEFAULT now(),
    last_used_at timestamp without time zone DEFAULT now(),
    usage_count integer DEFAULT 1
,
    PRIMARY KEY (symbol));


--
-- Name: TABLE coin_id_mappings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.coin_id_mappings IS 'Cache of symbol to CoinGecko coin ID mappings discovered dynamically';


--
-- Name: COLUMN coin_id_mappings.symbol; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coin_id_mappings.symbol IS 'Cryptocurrency symbol (e.g., BTC, ETH)';


--
-- Name: COLUMN coin_id_mappings.coin_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coin_id_mappings.coin_id IS 'CoinGecko coin ID (e.g., bitcoin, ethereum)';


--
-- Name: COLUMN coin_id_mappings.discovered_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coin_id_mappings.discovered_at IS 'When this mapping was first discovered';


--
-- Name: COLUMN coin_id_mappings.last_used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coin_id_mappings.last_used_at IS 'Last time this mapping was accessed';


--
-- Name: COLUMN coin_id_mappings.usage_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coin_id_mappings.usage_count IS 'Number of times this mapping has been used';


--
-- Name: discovered_coins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.discovered_coins (
    id integer NOT NULL,
    symbol character varying(10) NOT NULL,
    name character varying(100),
    market_cap_rank integer,
    market_cap numeric(20,2),
    current_price numeric(20,8),
    volume_24h numeric(20,2),
    volume_score numeric(5,2),
    price_momentum_score numeric(5,2),
    sentiment_score numeric(5,2),
    composite_score numeric(5,2),
    discovered_at timestamp without time zone DEFAULT now(),
    analyzed boolean DEFAULT false,
    recommendation_generated boolean DEFAULT false,
    sparkline_data jsonb,
    sparkline_fetched_at timestamp without time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: TABLE discovered_coins; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.discovered_coins IS 'Automatically discovered trading opportunities';


--
-- Name: COLUMN discovered_coins.composite_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.discovered_coins.composite_score IS 'Overall opportunity score (0-100)';


--
-- Name: COLUMN discovered_coins.sparkline_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.discovered_coins.sparkline_data IS '7-day price history array for sparkline charts';


--
-- Name: COLUMN discovered_coins.sparkline_fetched_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.discovered_coins.sparkline_fetched_at IS 'When sparkline data was last fetched';


--
-- Name: discovered_coins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.discovered_coins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discovered_coins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discovered_coins_id_seq OWNED BY public.discovered_coins.id;


--
-- Name: discovery_leaderboard; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.discovery_leaderboard AS
 SELECT discovered_coins.symbol,
    discovered_coins.name,
    discovered_coins.composite_score,
    discovered_coins.market_cap_rank,
    discovered_coins.volume_24h,
    discovered_coins.discovered_at,
    discovered_coins.analyzed,
    discovered_coins.recommendation_generated
   FROM public.discovered_coins
  WHERE (discovered_coins.discovered_at > (now() - '7 days'::interval))
  ORDER BY discovered_coins.composite_score DESC
 LIMIT 20;


--
-- Name: execution_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.execution_logs (
    id integer NOT NULL,
    recommendation_id integer,
    trade_id integer,
    approval_id integer,
    symbol character varying(10) NOT NULL,
    action character varying(10) NOT NULL,
    trigger_type character varying(30) NOT NULL,
    execution_method character varying(20) NOT NULL,
    settings_snapshot jsonb,
    risk_checks_passed boolean,
    risk_check_details jsonb,
    execution_time_ms integer,
    success boolean,
    error_message text,
    executed_at timestamp without time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: TABLE execution_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.execution_logs IS 'Detailed log of all trade executions';


--
-- Name: execution_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.execution_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: execution_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.execution_logs_id_seq OWNED BY public.execution_logs.id;


--
-- Name: feature_importance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.feature_importance (
    id integer NOT NULL,
    feature_name character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    score numeric(5,4) NOT NULL,
    sample_size integer,
    calculated_at timestamp with time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: feature_importance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.feature_importance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feature_importance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feature_importance_id_seq OWNED BY public.feature_importance.id;


--
-- Name: holdings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.holdings (
    id integer NOT NULL,
    symbol character varying(20) NOT NULL,
    quantity numeric(20,8) DEFAULT 0 NOT NULL,
    average_price numeric(20,8) NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    stop_loss numeric(20,8),
    take_profit numeric(20,8),
    protection_updated_at timestamp with time zone DEFAULT now(),
    user_id integer NOT NULL
,
    PRIMARY KEY (id));


--
-- Name: COLUMN holdings.stop_loss; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.holdings.stop_loss IS 'Price level to automatically sell and limit losses';


--
-- Name: COLUMN holdings.take_profit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.holdings.take_profit IS 'Price level to automatically sell and lock in profits';


--
-- Name: COLUMN holdings.protection_updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.holdings.protection_updated_at IS 'When stop loss or take profit was last modified';


--
-- Name: holdings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.holdings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: holdings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.holdings_id_seq OWNED BY public.holdings.id;


--
-- Name: market_context; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.market_context (
    id integer NOT NULL,
    btc_dominance numeric(5,2),
    eth_dominance numeric(5,2),
    total_market_cap numeric(20,2),
    total_volume numeric(20,2),
    altcoin_market_cap numeric(20,2),
    market_regime character varying(20),
    risk_sentiment character varying(20),
    fear_greed_index integer,
    sp500_price numeric(10,2),
    gold_price numeric(10,2),
    dxy_price numeric(10,2),
    vix_price numeric(10,2),
    vix_index numeric(10,2),
    market_timestamp timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: market_context_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.market_context_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: market_context_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.market_context_id_seq OWNED BY public.market_context.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    executed_at timestamp with time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.news (
    id integer NOT NULL,
    title text NOT NULL,
    url text NOT NULL,
    published_at timestamp with time zone NOT NULL,
    currencies text[],
    votes_positive integer DEFAULT 0,
    votes_negative integer DEFAULT 0,
    source character varying(100),
    domain character varying(100),
    created_at timestamp with time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: news_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.news_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: news_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.news_id_seq OWNED BY public.news.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(500) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    used_at timestamp with time zone,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: performance_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.performance_metrics (
    id integer NOT NULL,
    portfolio_value numeric(20,8) NOT NULL,
    cash_balance numeric(20,8) NOT NULL,
    total_return_pct numeric(10,4),
    sharpe_ratio numeric(10,4),
    max_drawdown numeric(10,4),
    win_rate numeric(5,4),
    total_trades integer DEFAULT 0,
    winning_trades integer DEFAULT 0,
    losing_trades integer DEFAULT 0,
    avg_win numeric(20,8),
    avg_loss numeric(20,8),
    calculated_at timestamp with time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: performance_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.performance_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: performance_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.performance_metrics_id_seq OWNED BY public.performance_metrics.id;


--
-- Name: portfolio_balance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.portfolio_balance (
    id integer NOT NULL,
    cash numeric(20,8) NOT NULL,
    total_value numeric(20,8),
    updated_at timestamp with time zone DEFAULT now(),
    user_id integer NOT NULL
,
    PRIMARY KEY (id));


--
-- Name: portfolio_balance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.portfolio_balance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portfolio_balance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.portfolio_balance_id_seq OWNED BY public.portfolio_balance.id;


--
-- Name: predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.predictions (
    id integer NOT NULL,
    symbol character varying(20) NOT NULL,
    action character varying(4) NOT NULL,
    entry_price numeric(20,8) NOT NULL,
    target_price numeric(20,8),
    stop_loss numeric(20,8),
    confidence numeric(5,2) NOT NULL,
    timeframe_hours integer NOT NULL,
    reasoning text,
    sources text[],
    input_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    evaluated_at timestamp with time zone,
    outcome jsonb
,
    PRIMARY KEY (id));


--
-- Name: predictions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.predictions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: predictions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.predictions_id_seq OWNED BY public.predictions.id;


--
-- Name: price_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.price_data (
    id integer NOT NULL,
    symbol character varying(20) NOT NULL,
    price numeric(20,8) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    volume_24h numeric(20,2),
    market_cap numeric(20,2),
    price_change_24h numeric(10,4)
,
    PRIMARY KEY (id));


--
-- Name: TABLE price_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.price_data IS 'Real-time price data collection for cryptocurrencies';


--
-- Name: price_data_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.price_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: price_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.price_data_id_seq OWNED BY public.price_data.id;


--
-- Name: prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.prices (
    "time" timestamp with time zone NOT NULL,
    symbol character varying(20) NOT NULL,
    open numeric(20,8),
    high numeric(20,8),
    low numeric(20,8),
    close numeric(20,8),
    volume numeric(20,8),
    timeframe character varying(10) NOT NULL
,
    PRIMARY KEY ("time", symbol, timeframe));


--
-- Name: trades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.trades (
    id integer NOT NULL,
    symbol character varying(20) NOT NULL,
    side character varying(4) NOT NULL,
    quantity numeric(20,8) NOT NULL,
    price numeric(20,8) NOT NULL,
    fee numeric(20,8) NOT NULL,
    slippage numeric(20,8) NOT NULL,
    total_cost numeric(20,8) NOT NULL,
    reasoning text,
    recommendation_id integer,
    executed_at timestamp with time zone DEFAULT now(),
    auto_executed boolean DEFAULT false,
    approval_id integer,
    trade_type character varying(20) DEFAULT 'manual'::character varying,
    triggered_by character varying(50),
    user_id integer NOT NULL,
    CONSTRAINT trades_side_check CHECK (((side)::text = ANY ((ARRAY['BUY'::character varying, 'SELL'::character varying])::text[]))),
    CONSTRAINT trades_trade_type_check CHECK (((trade_type)::text = ANY ((ARRAY['manual'::character varying, 'automatic'::character varying, 'stop_loss'::character varying, 'take_profit'::character varying])::text[])))
,
    PRIMARY KEY (id));


--
-- Name: COLUMN trades.trade_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trades.trade_type IS 'Type of trade: manual (user), automatic (AI), stop_loss (protection), take_profit (protection)';


--
-- Name: COLUMN trades.triggered_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trades.triggered_by IS 'What triggered the trade (e.g., "stop_loss_$24.50", "take_profit_$30.00", "recommendation_123", "user")';


--
-- Name: recent_executions; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.recent_executions AS
 SELECT el.id,
    el.recommendation_id,
    el.trade_id,
    el.approval_id,
    el.symbol,
    el.action,
    el.trigger_type,
    el.execution_method,
    el.settings_snapshot,
    el.risk_checks_passed,
    el.risk_check_details,
    el.execution_time_ms,
    el.success,
    el.error_message,
    el.executed_at,
    t.total_cost,
    t.fee,
    t.slippage
   FROM (public.execution_logs el
     LEFT JOIN public.trades t ON ((el.trade_id = t.id)))
  WHERE (el.executed_at > (now() - '7 days'::interval))
  ORDER BY el.executed_at DESC;


--
-- Name: recommendations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.recommendations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recommendations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recommendations_id_seq OWNED BY public.recommendations.id;


--
-- Name: sentiment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.sentiment (
    id integer NOT NULL,
    symbol character varying(20) NOT NULL,
    source character varying(50) NOT NULL,
    content text,
    score numeric(5,4),
    credibility numeric(5,4),
    author character varying(100),
    post_id character varying(100),
    upvotes integer DEFAULT 0,
    comments integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    author_karma integer DEFAULT 0,
    url character varying(500)
,
    PRIMARY KEY (id));


--
-- Name: COLUMN sentiment.author_karma; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sentiment.author_karma IS 'Author karma/reputation score from source';


--
-- Name: COLUMN sentiment.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sentiment.url IS 'URL to original content - use post_id for conflict resolution';


--
-- Name: sentiment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.sentiment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sentiment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sentiment_id_seq OWNED BY public.sentiment.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(500) NOT NULL,
    refresh_token character varying(500),
    expires_at timestamp with time zone NOT NULL,
    refresh_expires_at timestamp with time zone,
    ip_address character varying(45),
    user_agent text,
    is_active boolean DEFAULT true,
    last_activity timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: system_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.system_logs (
    id integer NOT NULL,
    level character varying(10) NOT NULL,
    component character varying(50),
    message text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: system_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.system_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;


--
-- Name: trade_approvals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.trade_approvals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trade_approvals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trade_approvals_id_seq OWNED BY public.trade_approvals.id;


--
-- Name: trades_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.trades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trades_id_seq OWNED BY public.trades.id;


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.user_settings (
    id integer NOT NULL,
    user_id integer DEFAULT 1,
    auto_execute boolean DEFAULT false,
    confidence_threshold integer DEFAULT 75,
    human_approval boolean DEFAULT true,
    position_sizing_strategy character varying(20) DEFAULT 'equal'::character varying,
    max_position_size numeric(5,2) DEFAULT 5.0,
    take_profit_strategy character varying(20) DEFAULT 'partial'::character varying,
    auto_stop_loss boolean DEFAULT true,
    coin_universe character varying(20) DEFAULT 'top50'::character varying,
    analysis_frequency integer DEFAULT 4,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    discovery_strategy character varying(20) DEFAULT 'moderate'::character varying,
    color_mode character varying(20) DEFAULT 'auto'::character varying,
    visual_style character varying(20) DEFAULT 'default'::character varying,
    CONSTRAINT user_settings_analysis_frequency_check CHECK ((analysis_frequency = ANY (ARRAY[1, 4, 8, 24]))),
    CONSTRAINT user_settings_coin_universe_check CHECK (((coin_universe)::text = ANY ((ARRAY['top10'::character varying, 'top50'::character varying, 'top100'::character varying])::text[]))),
    CONSTRAINT user_settings_color_mode_check CHECK (((color_mode)::text = ANY ((ARRAY['light'::character varying, 'dark'::character varying, 'auto'::character varying])::text[]))),
    CONSTRAINT user_settings_confidence_threshold_check CHECK (((confidence_threshold >= 70) AND (confidence_threshold <= 90))),
    CONSTRAINT user_settings_discovery_strategy_check CHECK (((discovery_strategy)::text = ANY ((ARRAY['conservative'::character varying, 'moderate'::character varying, 'aggressive'::character varying])::text[]))),
    CONSTRAINT user_settings_max_position_size_check CHECK (((max_position_size >= 2.0) AND (max_position_size <= 10.0))),
    CONSTRAINT user_settings_position_sizing_strategy_check CHECK (((position_sizing_strategy)::text = ANY ((ARRAY['equal'::character varying, 'confidence'::character varying])::text[]))),
    CONSTRAINT user_settings_take_profit_strategy_check CHECK (((take_profit_strategy)::text = ANY ((ARRAY['full'::character varying, 'partial'::character varying, 'trailing'::character varying])::text[]))),
    CONSTRAINT user_settings_visual_style_check CHECK (((visual_style)::text = ANY ((ARRAY['default'::character varying, 'glass'::character varying, 'compact'::character varying, 'comfortable'::character varying])::text[])))
,
    PRIMARY KEY (id));


--
-- Name: TABLE user_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_settings IS 'User trading preferences and configuration';


--
-- Name: COLUMN user_settings.auto_execute; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_settings.auto_execute IS 'Enable automatic trade execution';


--
-- Name: COLUMN user_settings.confidence_threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_settings.confidence_threshold IS 'Minimum AI confidence (70-90%) for auto-execution';


--
-- Name: COLUMN user_settings.human_approval; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_settings.human_approval IS 'Require manual approval before executing';


--
-- Name: COLUMN user_settings.take_profit_strategy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_settings.take_profit_strategy IS 'Exit strategy: full (sell 100%), partial (ladder out 50%), or trailing (trailing stop)';


--
-- Name: user_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.user_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_settings_id_seq OWNED BY public.user_settings.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    display_name character varying(100),
    google_id character varying(255),
    profile_picture_url text,
    email_verified boolean DEFAULT false,
    is_active boolean DEFAULT true,
    is_admin boolean DEFAULT false,
    failed_login_attempts integer DEFAULT 0,
    last_failed_login timestamp with time zone,
    locked_until timestamp with time zone,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
,
    PRIMARY KEY (id));


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: ai_review_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_review_logs ALTER COLUMN id SET DEFAULT nextval('public.ai_review_logs_id_seq'::regclass);


--
-- Name: altcoin_discoveries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.altcoin_discoveries ALTER COLUMN id SET DEFAULT nextval('public.altcoin_discoveries_id_seq'::regclass);


--
-- Name: api_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_usage ALTER COLUMN id SET DEFAULT nextval('public.api_usage_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: circuit_breakers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circuit_breakers ALTER COLUMN id SET DEFAULT nextval('public.circuit_breakers_id_seq'::regclass);


--
-- Name: discovered_coins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discovered_coins ALTER COLUMN id SET DEFAULT nextval('public.discovered_coins_id_seq'::regclass);


--
-- Name: execution_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_logs ALTER COLUMN id SET DEFAULT nextval('public.execution_logs_id_seq'::regclass);


--
-- Name: feature_importance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_importance ALTER COLUMN id SET DEFAULT nextval('public.feature_importance_id_seq'::regclass);


--
-- Name: holdings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings ALTER COLUMN id SET DEFAULT nextval('public.holdings_id_seq'::regclass);


--
-- Name: market_context id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_context ALTER COLUMN id SET DEFAULT nextval('public.market_context_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: news id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news ALTER COLUMN id SET DEFAULT nextval('public.news_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: performance_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_metrics ALTER COLUMN id SET DEFAULT nextval('public.performance_metrics_id_seq'::regclass);


--
-- Name: portfolio_balance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_balance ALTER COLUMN id SET DEFAULT nextval('public.portfolio_balance_id_seq'::regclass);


--
-- Name: predictions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predictions ALTER COLUMN id SET DEFAULT nextval('public.predictions_id_seq'::regclass);


--
-- Name: price_data id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_data ALTER COLUMN id SET DEFAULT nextval('public.price_data_id_seq'::regclass);


--
-- Name: recommendations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations ALTER COLUMN id SET DEFAULT nextval('public.recommendations_id_seq'::regclass);


--
-- Name: sentiment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sentiment ALTER COLUMN id SET DEFAULT nextval('public.sentiment_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: system_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_logs ALTER COLUMN id SET DEFAULT nextval('public.system_logs_id_seq'::regclass);


--
-- Name: trade_approvals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_approvals ALTER COLUMN id SET DEFAULT nextval('public.trade_approvals_id_seq'::regclass);


--
-- Name: trades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trades ALTER COLUMN id SET DEFAULT nextval('public.trades_id_seq'::regclass);


--
-- Name: user_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings ALTER COLUMN id SET DEFAULT nextval('public.user_settings_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: api_usage api_usage_api_name_endpoint_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_usage
    ADD CONSTRAINT api_usage_api_name_endpoint_date_key UNIQUE (api_name, endpoint, date);


--
-- Name: discovered_coins discovered_coins_symbol_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discovered_coins
    ADD CONSTRAINT discovered_coins_symbol_key UNIQUE (symbol);


--
-- Name: holdings holdings_symbol_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_symbol_key UNIQUE (symbol);


--
-- Name: migrations migrations_filename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_filename_key UNIQUE (filename);


--
-- Name: news news_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_url_key UNIQUE (url);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: sentiment sentiment_post_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sentiment
    ADD CONSTRAINT sentiment_post_id_key UNIQUE (post_id);


--
-- Name: sessions sessions_refresh_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_refresh_token_key UNIQUE (refresh_token);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: idx_ai_review_logs_review_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_ai_review_logs_review_type ON public.ai_review_logs USING btree (review_type);


--
-- Name: idx_ai_review_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_ai_review_logs_status ON public.ai_review_logs USING btree (status);


--
-- Name: idx_ai_review_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_ai_review_logs_timestamp ON public.ai_review_logs USING btree ("timestamp" DESC);


--
-- Name: idx_ai_review_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_ai_review_logs_user_id ON public.ai_review_logs USING btree (user_id);


--
-- Name: idx_altcoin_discoveries_discovered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_altcoin_discoveries_discovered ON public.altcoin_discoveries USING btree (discovered_at DESC);


--
-- Name: idx_altcoin_discoveries_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_altcoin_discoveries_rank ON public.altcoin_discoveries USING btree (rank, discovered_at DESC);


--
-- Name: idx_api_usage_api; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_api_usage_api ON public.api_usage USING btree (api_name, date DESC);


--
-- Name: idx_api_usage_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_api_usage_date ON public.api_usage USING btree (date DESC);


--
-- Name: idx_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log USING btree (action);


--
-- Name: idx_audit_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_log_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON public.audit_log USING btree (resource_type, resource_id);


--
-- Name: idx_audit_log_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_success ON public.audit_log USING btree (success);


--
-- Name: idx_audit_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log USING btree (user_id);


--
-- Name: idx_circuit_breakers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_circuit_breakers_status ON public.circuit_breakers USING btree (status, triggered_at DESC);


--
-- Name: idx_coin_id_mappings_last_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_coin_id_mappings_last_used ON public.coin_id_mappings USING btree (last_used_at DESC);


--
-- Name: idx_discovered_coins_analyzed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_discovered_coins_analyzed ON public.discovered_coins USING btree (analyzed, composite_score DESC);


--
-- Name: idx_discovered_coins_fetched_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_discovered_coins_fetched_at ON public.discovered_coins USING btree (sparkline_fetched_at DESC);


--
-- Name: idx_discovered_coins_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_discovered_coins_score ON public.discovered_coins USING btree (composite_score DESC, discovered_at DESC);


--
-- Name: idx_execution_logs_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_execution_logs_success ON public.execution_logs USING btree (success, executed_at DESC);


--
-- Name: idx_execution_logs_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_execution_logs_symbol ON public.execution_logs USING btree (symbol, executed_at DESC);


--
-- Name: idx_execution_logs_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_execution_logs_trigger ON public.execution_logs USING btree (trigger_type, executed_at DESC);


--
-- Name: idx_feature_importance_calc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_feature_importance_calc ON public.feature_importance USING btree (calculated_at DESC);


--
-- Name: idx_feature_importance_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_feature_importance_category ON public.feature_importance USING btree (category, calculated_at DESC);


--
-- Name: idx_holdings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON public.holdings USING btree (user_id);


--
-- Name: idx_market_context_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_market_context_created ON public.market_context USING btree (created_at);


--
-- Name: idx_market_context_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_market_context_timestamp ON public.market_context USING btree (market_timestamp);


--
-- Name: idx_news_currencies; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_news_currencies ON public.news USING gin (currencies);


--
-- Name: idx_news_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_news_published ON public.news USING btree (published_at DESC);


--
-- Name: idx_password_reset_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: idx_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_password_reset_tokens_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON public.password_reset_tokens USING btree (used);


--
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_performance_metrics_calc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_performance_metrics_calc ON public.performance_metrics USING btree (calculated_at DESC);


--
-- Name: idx_portfolio_balance_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_portfolio_balance_user_id ON public.portfolio_balance USING btree (user_id);


--
-- Name: idx_predictions_evaluated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_predictions_evaluated ON public.predictions USING btree (evaluated_at);


--
-- Name: idx_predictions_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_predictions_symbol ON public.predictions USING btree (symbol, created_at DESC);


--
-- Name: idx_price_data_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_price_data_symbol ON public.price_data USING btree (symbol, "timestamp" DESC);


--
-- Name: idx_price_data_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_price_data_timestamp ON public.price_data USING btree ("timestamp" DESC);


--
-- Name: idx_prices_symbol_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prices_symbol_time ON public.prices USING btree (symbol, "time" DESC);


--
-- Name: idx_prices_timeframe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prices_timeframe ON public.prices USING btree (timeframe, "time" DESC);


--
-- Name: idx_recommendations_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_recommendations_created ON public.recommendations USING btree (created_at DESC);


--
-- Name: idx_recommendations_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_recommendations_symbol ON public.recommendations USING btree (symbol, created_at DESC);


--
-- Name: idx_recommendations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON public.recommendations USING btree (user_id);


--
-- Name: idx_sentiment_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_sentiment_created ON public.sentiment USING btree (created_at DESC);


--
-- Name: idx_sentiment_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_sentiment_source ON public.sentiment USING btree (source, created_at DESC);


--
-- Name: idx_sentiment_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_sentiment_symbol ON public.sentiment USING btree (symbol, created_at DESC);


--
-- Name: idx_sentiment_url_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_sentiment_url_lookup ON public.sentiment USING btree (url) WHERE (url IS NOT NULL);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON public.sessions USING btree (is_active);


--
-- Name: idx_sessions_refresh_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON public.sessions USING btree (refresh_token);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions USING btree (token);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_system_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_system_logs_created ON public.system_logs USING btree (created_at DESC);


--
-- Name: idx_system_logs_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs USING btree (level, created_at DESC);


--
-- Name: idx_trade_approvals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_trade_approvals_status ON public.trade_approvals USING btree (status, created_at DESC);


--
-- Name: idx_trade_approvals_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_trade_approvals_symbol ON public.trade_approvals USING btree (symbol, created_at DESC);


--
-- Name: idx_trades_executed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_trades_executed ON public.trades USING btree (executed_at DESC);


--
-- Name: idx_trades_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_trades_symbol ON public.trades USING btree (symbol, executed_at DESC);


--
-- Name: idx_trades_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_trades_type ON public.trades USING btree (trade_type, executed_at DESC);


--
-- Name: idx_trades_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades USING btree (user_id);


--
-- Name: idx_user_settings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings USING btree (user_id);


--
-- Name: idx_users_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users USING btree (google_id);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: prices_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS prices_time_idx ON public.prices USING btree ("time" DESC);


--
-- Name: user_settings update_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_review_logs ai_review_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_review_logs
    ADD CONSTRAINT ai_review_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: execution_logs execution_logs_approval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.trade_approvals(id);


--
-- Name: execution_logs execution_logs_recommendation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_recommendation_id_fkey FOREIGN KEY (recommendation_id) REFERENCES public.recommendations(id);


--
-- Name: execution_logs execution_logs_trade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_trade_id_fkey FOREIGN KEY (trade_id) REFERENCES public.trades(id);


--
-- Name: holdings fk_holdings_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT fk_holdings_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: portfolio_balance portfolio_balance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_balance
    ADD CONSTRAINT portfolio_balance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recommendations recommendations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: trade_approvals trade_approvals_recommendation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_approvals
    ADD CONSTRAINT trade_approvals_recommendation_id_fkey FOREIGN KEY (recommendation_id) REFERENCES public.recommendations(id);


--
-- Name: trades trades_approval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trades
    ADD CONSTRAINT trades_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.trade_approvals(id);


--
-- Name: trades trades_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trades
    ADD CONSTRAINT trades_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

