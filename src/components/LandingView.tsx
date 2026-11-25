import React from 'react';
import {
  ArrowRight,
  Blocks,
  Cpu,
  Layers,
  LineChart,
  Radio,
  Share2,
  ShieldCheck,
  Sparkles,
  Webhook,
  Zap,
  Check,
  Crown,
} from 'lucide-react';

interface LandingViewProps {
  onLaunchApp: () => void;
  onOpenPricing: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onLaunchApp, onOpenPricing }) => {
  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-8 md:py-12">
      {/* ヒーローセクション（2カラム近未来HUDコックピット） */}
      <section className="hud-panel relative overflow-hidden rounded-3xl p-7 md:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-12 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />

        <div className="relative z-10 grid items-center gap-10 lg:grid-cols-12">
          {/* 左カラム: メインコピー & CTA */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              QUANTBLOCK v2.0 · 15m / 30m DAY-TRADING LIVE
            </div>

            <h1 className="font-display mt-5 text-3xl font-extrabold leading-[1.18] tracking-tight text-white md:text-5xl">
              コードを書かずに、
              <br />
              <span className="holo-text">勝てるデイトレ戦略</span>
              を
              <br className="hidden sm:block" />
              3分で検証・自動化。
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-slate-300 md:text-[15px]">
              PythonもPine Scriptも不要。移動平均・VWAP・ADX・RSIを量子回路のように繋ぐだけで、
              <strong className="text-cyan-200">Binance 本物データ最大3,000本</strong> での厳密バックテスト（次足始値約定）、過学習チェック(OOS)、1,000回モンテカルロ破産リスク試算、具体的なBUY・損切り・利確価格の算出まで一瞬で完了します。
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onLaunchApp}
                className="glow-cyan inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white transition hover:brightness-110"
              >
                今すぐ無料で戦略を構築する
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onOpenPricing}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-[#060d1c]/90 px-5 py-3.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-500/10"
              >
                料金プランを見る（¥0〜）
              </button>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-cyan-500/15 pt-5 font-mono text-xs sm:grid-cols-4">
              <div>
                <div className="text-lg font-extrabold text-cyan-300">3,000本</div>
                <div className="mt-0.5 font-sans text-[11px] text-slate-400">
                  15m/30m LIVE相場
                </div>
              </div>
              <div>
                <div className="text-lg font-extrabold text-emerald-400">&lt; 3ms</div>
                <div className="mt-0.5 font-sans text-[11px] text-slate-400">
                  次足始値 厳密検証
                </div>
              </div>
              <div>
                <div className="text-lg font-extrabold text-violet-300">OOS + 1,000回</div>
                <div className="mt-0.5 font-sans text-[11px] text-slate-400">
                  過学習＆破産確率
                </div>
              </div>
              <div>
                <div className="text-lg font-extrabold text-amber-300">Pine / URL</div>
                <div className="mt-0.5 font-sans text-[11px] text-slate-400">
                  自動出力＆戦略共有
                </div>
              </div>
            </div>
          </div>

          {/* 右カラム: インタラクティブ近未来HUDプレビュー */}
          <div className="lg:col-span-5">
            <div
              onClick={onLaunchApp}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onLaunchApp();
              }}
              className="group cursor-pointer rounded-2xl border border-cyan-400/30 bg-[#040916]/90 p-5 shadow-[0_0_40px_-12px_rgba(34,211,238,0.4)] transition hover:border-cyan-300/70"
            >
              <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
                <div>
                  <div className="font-mono text-[10px] tracking-widest text-cyan-400">
                    OOS GRADE A · VERIFIED CIRCUIT
                  </div>
                  <div className="font-display mt-0.5 text-sm font-bold text-white">
                    BTC・30分足｜長期EMA×RSI (L/S)
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  GRADE A
                </span>
              </div>

              {/* ミニ量子回路 */}
              <div className="mt-4 space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-2">
                  <span className="text-emerald-300">LONG 順張り</span>
                  <span className="text-slate-100">Close &gt; EMA(160) &amp; RSI↗42</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-purple-500/30 bg-purple-950/20 px-3 py-2">
                  <span className="text-purple-300">SHORT 戻り売り</span>
                  <span className="text-slate-100">Close &lt; EMA(160) &amp; RSI↘58</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-3 py-2">
                  <span className="text-cyan-300">実相場3,000本</span>
                  <span className="text-emerald-300 font-bold">勝率 66.7% · PF 4.10</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 py-1.5">
                    <div className="text-[9px] text-rose-300">損切り SL</div>
                    <div className="font-bold text-rose-200">-2.5%</div>
                  </div>
                  <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 py-1.5">
                    <div className="text-[9px] text-sky-300">利確 TP</div>
                    <div className="font-bold text-sky-200">+2.2%</div>
                  </div>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 py-1.5">
                    <div className="text-[9px] text-amber-300">最大DD</div>
                    <div className="font-bold text-amber-200">-9.5%</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-violet-500/30 bg-violet-950/25 px-3 py-2 text-xs">
                <span className="text-violet-200">クリックして実際のビルダーで試す</span>
                <ArrowRight className="h-4 w-4 text-cyan-300 transition group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6つのコア機能 */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-xs font-bold tracking-widest text-cyan-400">
              CORE CAPABILITIES
            </div>
            <h2 className="font-display mt-1 text-2xl font-extrabold text-white">
              中級トレーダーと金融工学の知見を凝縮した6つの武器
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            ログイン不要・ブラウザだけで即体験可能
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Blocks,
              color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
              title: '量子回路ブロックビルダー',
              desc: 'EMA/SMA・VWAP・ADX・RSI・MACD・BBを直感接続。数値を変えた瞬間に「取引回数 16回 → 0回」の差分を編集欄のすぐ上に出し、1クリックで元に戻せます。',
            },
            {
              icon: Radio,
              color: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30',
              title: '15m/30m LIVE相場 & 注文価格算出',
              desc: 'Binance本物データ最大3,000本を自動連結取得。時間足連動のSL/TP自動調整、現在ATR基準の自動算出、許容リスク別の推奨注文額と水平ラインを即提示します。',
            },
            {
              icon: ShieldCheck,
              color: 'text-violet-300 bg-violet-500/15 border-violet-500/30',
              title: '次足始値約定 & 過学習チェック(OOS)',
              desc: '先読みバイアスを完全排除した次足始値約定に対応。前半70%（学習）vs 後半30%（未知相場）の分離検証で「たまたま勝てた設定」をA〜Dランクで自動診断します。',
            },
            {
              icon: Cpu,
              color: 'text-sky-300 bg-sky-500/15 border-sky-500/30',
              title: '2次元最適化 & 1,000回モンテカルロ',
              desc: '時間足・銘柄に応じたSL×TPや期間の25通りヒートマップを一括計算。さらに1,000回ブートストラップで95%信頼区間とDD30%超の破産確率を可視化します。',
            },
            {
              icon: Layers,
              color: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
              title: 'L/S両建て & 5銘柄ポートフォリオ分散',
              desc: 'ロング＆ショート両方向の検証に加え、仮想通貨・FX・米国株・先物の5銘柄一括スキャンと相関係数マトリクスで分散投資のドローダウン削減効果を実証できます。',
            },
            {
              icon: Share2,
              color: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
              title: 'Pine v5 / Python / Webhook / URL共有',
              desc: '構築した戦略はTradingView Pine Script v5・Pythonコード・Bybit/Binance Webhookへ即変換。1200×630 PNG画像や戦略再現URLでX・仲間へワンクリック共有できます。',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="hud-panel rounded-2xl p-5 transition hover:border-cyan-400/45"
              >
                <div className={`inline-flex rounded-xl border p-2.5 ${item.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3ステップ・ワークフロー */}
      <section className="hud-panel rounded-3xl p-7 md:p-9">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-mono text-xs font-bold tracking-widest text-cyan-400">
              WORKFLOW
            </div>
            <h2 className="font-display mt-1 text-xl font-extrabold text-white">
              「勘のトレード」を再現性のあるシステムへ変える3ステップ
            </h2>
          </div>
          <button
            type="button"
            onClick={onLaunchApp}
            className="glow-emerald inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110"
          >
            <Zap className="h-3.5 w-3.5" />
            今すぐビルダーを開く
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: 'STEP 01',
              title: 'ブロックを繋いで売買ルールを構築',
              desc: '15m/30mデイトレ公式テンプレートから選ぶか、VWAP・ADX・RSIブロックを自由に編集。変更直後の勝率・取引回数変化をその場で確認できます。',
              icon: LineChart,
            },
            {
              step: 'STEP 02',
              title: '実相場3,000本＋過学習チェックで精査',
              desc: '次足始値約定・手数料込みで厳密検証。後半30%の未知相場(OOS)と1,000回モンテカルロを通過した本物のエッジだけを残します。',
              icon: ShieldCheck,
            },
            {
              step: 'STEP 03',
              title: '注文価格コピー・コード出力・自動売買へ',
              desc: '具体的なBUY/SL/TP価格をコピーして発注するか、Pine Script / Webhook自動売買へ接続。戦略URLで検証結果を仲間と共有することも可能です。',
              icon: Webhook,
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="rounded-2xl border border-cyan-500/15 bg-[#040916]/85 p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-cyan-400">{s.step}</span>
                  <Icon className="h-4 w-4 text-slate-500" />
                </div>
                <div className="mt-3 text-sm font-bold text-white">{s.title}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 料金プランプレビュー（LP内セクション） */}
      <section className="space-y-5">
        <div className="text-center">
          <div className="font-mono text-xs font-bold tracking-widest text-cyan-400">
            PRICING PLANS
          </div>
          <h2 className="font-display mt-1 text-2xl font-extrabold text-white">
            1回の無駄な損切りを防ぐだけで回収できるプライシング
          </h2>
          <p className="mt-2 text-xs text-slate-400">
            まずは無料Starterプランで全コア機能をお試しください（Stripe定期課金・いつでも解約可能）
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              name: 'Starter (Free)',
              price: '¥0',
              unit: '/ 月',
              desc: 'ノーコード検証を試したい個人投資家向け',
              items: [
                '15m/30m LIVE相場（最大3,000本）',
                '量子回路ブロックビルダー & L/S対応',
                'BUY / SL / TP 想定注文プランナー',
                '戦略URLシェア & PNG検証カード',
              ],
              highlight: false,
            },
            {
              name: 'Pro Trader',
              price: '¥9,800',
              unit: '/ 月',
              desc: '優位性を科学的に磨き上げる中級デイトレーダー向け',
              items: [
                'Starterの全機能 + 戦略保存無制限',
                '2次元グリッドサーチ・最適化ヒートマップ',
                '過学習チェック(OOS) & 1,000回モンテカルロ',
                '独自OHLCV CSV無制限 & トレード履歴CSV出力',
              ],
              highlight: true,
            },
            {
              name: 'Quant Institutional',
              price: '¥29,800',
              unit: '/ 月',
              desc: '検証から24時間自動売買まで完結させるプロ向け',
              items: [
                'Pro Traderの全機能すべて',
                'Bybit / Binance / Discord Webhook自動連携',
                '5銘柄ポートフォリオ相関＆分散分析',
                '高頻度API優先枠 & カスタム指標リクエスト',
              ],
              highlight: false,
            },
          ].map((p) => (
            <div
              key={p.name}
              className={`hud-panel flex flex-col justify-between rounded-2xl p-6 ${
                p.highlight
                  ? 'border-cyan-400/50 shadow-[0_0_34px_-10px_rgba(34,211,238,0.45)]'
                  : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-white">{p.name}</span>
                  {p.highlight && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
                      <Sparkles className="h-3 w-3" /> 人気
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-extrabold text-white">{p.price}</span>
                  <span className="text-xs text-slate-400">{p.unit}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{p.desc}</p>
                <ul className="mt-4 space-y-2 text-xs text-slate-200">
                  {p.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={p.price === '¥0' ? onLaunchApp : onOpenPricing}
                className={`mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  p.highlight
                    ? 'glow-cyan bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:brightness-110'
                    : 'border border-cyan-500/25 bg-[#060d1c] text-cyan-100 hover:border-cyan-400/60'
                }`}
              >
                {p.price === '¥0' ? (
                  <>
                    無料で使い始める <ArrowRight className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    <Crown className="h-3.5 w-3.5 text-amber-300" /> プラン詳細を見る
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
