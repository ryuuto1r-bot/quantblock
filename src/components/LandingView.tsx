import React from 'react';
import {
  ArrowRight,
  Blocks,
  Cpu,
  LineChart,
  ShieldCheck,
  Sparkles,
  Webhook,
  Zap,
} from 'lucide-react';

interface LandingViewProps {
  onLaunchApp: () => void;
  onOpenPricing: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onLaunchApp, onOpenPricing }) => {
  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-10 md:py-16">
      {/* ヒーロー */}
      <section className="hud-panel relative overflow-hidden rounded-3xl p-8 md:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-12 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3.5 py-1 font-mono text-xs font-semibold text-cyan-200">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            NEXT-GEN NO-CODE QUANT TERMINAL · 15m / 30m LIVE
          </div>

          <h1 className="font-display mt-5 text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
            コードを書かずに、
            <span className="holo-text">
              勝てるトレード戦略
            </span>
            を3分で検証・自動化。
          </h1>

          <p className="mt-5 text-sm leading-relaxed text-slate-300 md:text-base">
            PythonやPine Scriptは不要。「移動平均線がクロスし、かつRSIが65以下の時に買い」といったルールをブロックで繋ぐだけで、過去5年分のチャートデータによる超高速バックテスト、2次元パラメータ最適化、1,000回モンテカルロ破産確率分析まで一瞬で完了します。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onLaunchApp}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-950/60 transition hover:bg-indigo-500"
            >
              今すぐ戦略ビルダーを起動する
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onOpenPricing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              料金プランを見る（¥0〜）
            </button>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-800/80 pt-6 font-mono text-xs">
            <div>
              <div className="text-xl font-extrabold text-emerald-400">&lt; 3ms</div>
              <div className="mt-0.5 font-sans text-slate-400">過去5年分バックテスト速度</div>
            </div>
            <div>
              <div className="text-xl font-extrabold text-sky-400">1,000回</div>
              <div className="mt-0.5 font-sans text-slate-400">モンテカルロ破産リスク試算</div>
            </div>
            <div>
              <div className="text-xl font-extrabold text-indigo-400">Pine v5 / Py</div>
              <div className="mt-0.5 font-sans text-slate-400">ワンクリック自動コード変換</div>
            </div>
          </div>
        </div>
      </section>

      {/* 選ばれる理由 */}
      <section className="grid gap-5 md:grid-cols-3">
        {[
          {
            icon: Blocks,
            color: 'text-emerald-400 bg-emerald-500/15',
            title: '直感的なブロック接続UI',
            desc: 'SMA/EMA・RSI・MACD・ボリンジャーバンド・ストキャスティクス・出来高をドラッグ＆クリックで結合。AND/ORゲートや損切り・トレーリングストップも一目で設計できます。',
          },
          {
            icon: Cpu,
            color: 'text-indigo-400 bg-indigo-500/15',
            title: '金融工学ベースの検証エンジン',
            desc: '単なる勝率だけでなく、シャープレシオ・ソルティノレシオ・最大DD・月次リターン・グリッド最適化ヒートマップ・モンテカルロ信頼区間を自動算出。過学習を徹底排除します。',
          },
          {
            icon: Webhook,
            color: 'text-sky-400 bg-sky-500/15',
            title: '検証から本番自動売買へ直結',
            desc: '構築したブロックは即座にTradingView Pine Script v5 / Pythonコードへ変換可能。さらにBybit / Binance向けWebhookペイロード生成で24時間自動運用へ繋げられます。',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-800/90 bg-[#0b1220] p-6"
            >
              <div className={`inline-flex rounded-xl p-2.5 ${item.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.desc}</p>
            </div>
          );
        })}
      </section>

      {/* ワークフロー */}
      <section className="rounded-3xl border border-slate-800/90 bg-[#0b1220] p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-white">
              中級トレーダーの「勘」を、再現性のあるエッジに変える3ステップ
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              独自CSVアップロード対応。手元の取引所データでもそのまま検証可能です。
            </p>
          </div>
          <button
            type="button"
            onClick={onLaunchApp}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
          >
            <Zap className="h-3.5 w-3.5" />
            ワークスペースを開く
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: 'STEP 01',
              title: 'ブロックを繋いでロジック構築',
              desc: 'プリセット戦略をベースにするか、ゼロから売買条件と損切り・利確ルールを組み立てます。',
              icon: LineChart,
            },
            {
              step: 'STEP 02',
              title: '数ミリ秒で過去5年分を検証',
              desc: 'ローソク足上の全売買シグナル、資産曲線、ドローダウン、モンテカルロ分布を即座に可視化。',
              icon: ShieldCheck,
            },
            {
              step: 'STEP 03',
              title: '最適化して本番トレードへ',
              desc: 'ヒートマップで安定パラメータを選び、Pine Script出力またはWebhook連携で実運用を開始。',
              icon: Sparkles,
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-400">{s.step}</span>
                  <Icon className="h-4 w-4 text-slate-500" />
                </div>
                <div className="mt-3 text-sm font-bold text-white">{s.title}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
