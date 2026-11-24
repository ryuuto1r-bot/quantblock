import React, { useState } from 'react';
import { Check, CreditCard, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import type { PlanTier } from '../types/quant';
import { isLocalApiAvailable } from '../engine/liveMarketClient';

interface PricingModalProps {
  currentPlan: PlanTier;
  onSelectPlan: (plan: PlanTier) => void;
  onClose: () => void;
}

const PLANS: {
  id: PlanTier;
  name: string;
  price: string;
  period: string;
  tagline: string;
  highlight?: boolean;
  features: string[];
  cta: string;
}[] = [
  {
    id: 'free',
    name: 'Starter (Free)',
    price: '¥0',
    period: '/ 月',
    tagline: 'ノーコード検証を試したい個人投資家向け',
    features: [
      'ビジュアル・ブロック戦略ビルダー',
      '主要5銘柄（仮想通貨 / FX / 米国株 / 先物）',
      'リアルタイム高速バックテスト＆チャート描画',
      '戦略のローカル保存（3戦略まで）',
      'Pine Script v5 / Python プレビュー',
    ],
    cta: '無料プランを使う',
  },
  {
    id: 'pro',
    name: 'Pro Trader',
    price: '¥9,800',
    period: '/ 月（税込）',
    tagline: '勝てる優位性を科学的に見つけ出す中級トレーダー向け',
    highlight: true,
    features: [
      'Starterの全機能 + 保存戦略数 無制限',
      '2次元グリッドサーチ・パラメータ最適化ヒートマップ',
      '1,000回モンテカルロ・ブートストラップ破産確率分析',
      '独自OHLCV CSVデータ無制限インポート',
      '月次リターン分析 & トレード履歴CSV出力',
    ],
    cta: 'StripeでProを始める',
  },
  {
    id: 'quant',
    name: 'Quant Institutional',
    price: '¥29,800',
    period: '/ 月（税込）',
    tagline: '検証から24時間自動売買まで完結させる専業・プロ投資家向け',
    features: [
      'Pro Traderの全機能すべて',
      'Bybit / Binance / TradingView Webhook自動売買連携',
      '複数戦略のポートフォリオ相関＆ドローダウン分散',
      '1分足・5分足の高頻度バックテスト優先枠',
      '専用Slack/Discordサポート＆カスタム指標リクエスト',
    ],
    cta: 'StripeでQuantを始める',
  },
];

export const PricingModal: React.FC<PricingModalProps> = ({
  currentPlan,
  onSelectPlan,
  onClose,
}) => {
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleCheckout = async (plan: PlanTier) => {
    if (plan === 'free') {
      onSelectPlan('free');
      setStatusMsg('Starter (Free) プランへ切り替えました。');
      return;
    }

    setLoadingPlan(plan);
    setStatusMsg(null);
    if (!isLocalApiAvailable()) {
      onSelectPlan(plan);
      setStatusMsg(
        `デモ決済モードで ${plan.toUpperCase()} プランを有効化しました（全機能をお試しいただけます）。`
      );
      setLoadingPlan(null);
      return;
    }
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.mode === 'stripe_live' && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
        onSelectPlan(plan);
        setStatusMsg(
          `Stripeデモ決済が完了しました（Session: ${data.sessionId}）。${plan.toUpperCase()} プランの全機能が即時有効化されています。`
        );
      } else {
        throw new Error('api_unavailable');
      }
    } catch {
      onSelectPlan(plan);
      setStatusMsg(
        `ローカルデモ決済モードで ${plan.toUpperCase()} プランを有効化しました（.envにSTRIPE_SECRET_KEYを設定すると本番Stripe Checkout画面へ自動遷移します）。`
      );
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-700/80 bg-[#0b1120] p-6 shadow-2xl md:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
            <CreditCard className="h-3.5 w-3.5" />
            Stripe 定期課金対応 · いつでもワンクリック解約
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            勝率と期待値に投資する、プロ仕様の料金プラン
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            1回の無駄な損切りを防ぐだけで月額料金は回収できます。バックテストからモンテカルロ・自動売買連携まで段階的にアップグレード可能です。
          </p>
        </div>

        {statusMsg && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-200">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{statusMsg}</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = currentPlan === p.id;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition ${
                  p.highlight
                    ? 'border-indigo-500 bg-gradient-to-b from-indigo-950/50 to-[#0d1425] shadow-xl shadow-indigo-950/40'
                    : 'border-slate-800 bg-[#0d1425]'
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-indigo-500 px-3 py-0.5 text-[10px] font-bold text-white">
                    <Sparkles className="h-3 w-3" /> 一番人気
                  </span>
                )}
                <div>
                  <div className="text-sm font-bold text-white">{p.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-mono text-3xl font-extrabold text-white">{p.price}</span>
                    <span className="text-xs text-slate-400">{p.period}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{p.tagline}</p>

                  <ul className="mt-5 space-y-2.5 text-xs text-slate-200">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={loadingPlan !== null}
                  onClick={() => handleCheckout(p.id)}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                    isCurrent
                      ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : p.highlight
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                      : 'border border-slate-700 bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  {loadingPlan === p.id
                    ? 'Stripeセッション作成中...'
                    : isCurrent
                    ? '現在ご利用中のプラン'
                    : p.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
