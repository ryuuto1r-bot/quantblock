import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  BackgroundVariant,
} from '@xyflow/react';
import {
  Database,
  TrendingUp,
  TrendingDown,
  GitMerge,
  ShieldCheck,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { ConditionRule, LogicGate, StrategySpec } from '../types/quant';
import { ruleToNaturalJapanese } from '../utils/format';

export type SelectedBlock =
  | { type: 'market' }
  | { type: 'entry_rule'; ruleId: string }
  | { type: 'exit_rule'; ruleId: string }
  | { type: 'entry_gate' }
  | { type: 'exit_gate' }
  | { type: 'execution' };

interface VisualFlowBuilderProps {
  strategy: StrategySpec;
  barCount: number;
  selectedBlock: SelectedBlock;
  onSelectBlock: (block: SelectedBlock) => void;
  onToggleEntryLogic: () => void;
  onToggleExitLogic: () => void;
  onAddEntryRule: () => void;
  onAddExitRule: () => void;
}

type MarketNodeData = {
  symbol: string;
  timeframe: string;
  barCount: number;
  selected: boolean;
};

type RuleNodeData = {
  kind: 'entry' | 'exit';
  rule: ConditionRule;
  selected: boolean;
};

type GateNodeData = {
  kind: 'entry' | 'exit';
  gate: LogicGate;
  ruleCount: number;
  selected: boolean;
  onToggle: () => void;
};

type ExecutionNodeData = {
  strategy: StrategySpec;
  selected: boolean;
};

function MarketNode({ data }: NodeProps<Node<MarketNodeData>>) {
  return (
    <div
      className={`relative w-[220px] overflow-hidden rounded-2xl border bg-[#060d1c]/90 p-3.5 shadow-2xl backdrop-blur-xl transition-all ${
        data.selected
          ? 'border-cyan-400 shadow-[0_0_26px_-4px_rgba(34,211,238,0.55)] ring-1 ring-cyan-300/40'
          : 'border-cyan-500/25 hover:border-cyan-400/70'
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-cyan-300">
          <Database className="h-3 w-3" />
          マーケットデータ
        </span>
        <span className="rounded bg-cyan-950/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
          {data.timeframe}
        </span>
      </div>
      <div className="font-display text-base font-bold tracking-wider text-white">
        {data.symbol}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
        過去 {data.barCount.toLocaleString()} 本のOHLCV
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-[#060d1c] !bg-cyan-400 !shadow-[0_0_10px_#22d3ee]"
      />
    </div>
  );
}

function RuleNode({ data }: NodeProps<Node<RuleNodeData>>) {
  const isEntry = data.kind === 'entry';
  const accentBorder = data.selected
    ? isEntry
      ? 'border-emerald-400 shadow-[0_0_26px_-4px_rgba(16,185,129,0.55)] ring-1 ring-emerald-300/40'
      : 'border-rose-400 shadow-[0_0_26px_-4px_rgba(244,63,94,0.55)] ring-1 ring-rose-300/40'
    : isEntry
    ? 'border-emerald-500/30 hover:border-emerald-400/75'
    : 'border-rose-500/30 hover:border-rose-400/75';

  return (
    <div
      className={`relative w-[258px] overflow-hidden rounded-2xl border bg-[#071022]/90 p-3.5 shadow-2xl backdrop-blur-xl transition-all ${accentBorder} ${
        !data.rule.enabled ? 'opacity-40 grayscale' : ''
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${
          isEntry ? 'via-emerald-400' : 'via-rose-400'
        } to-transparent opacity-75`}
      />
      <Handle
        type="target"
        position={Position.Left}
        className={`!h-2.5 !w-2.5 !border-2 !border-[#071022] ${
          isEntry ? '!bg-emerald-400' : '!bg-rose-400'
        }`}
      />
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide ${
            isEntry
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          {isEntry ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isEntry ? '買い条件ブロック' : '売り条件ブロック'}
        </span>
        {!data.rule.enabled && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            OFF
          </span>
        )}
      </div>
      <div className="text-xs font-bold text-slate-100">{data.rule.label}</div>
      <div className="mt-1.5 rounded-xl border border-cyan-500/15 bg-[#030712]/90 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-cyan-200">
        {ruleToNaturalJapanese(data.rule)}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className={`!h-2.5 !w-2.5 !border-2 !border-[#071022] ${
          isEntry ? '!bg-emerald-400' : '!bg-rose-400'
        }`}
      />
    </div>
  );
}

function GateNode({ data }: NodeProps<Node<GateNodeData>>) {
  const isEntry = data.kind === 'entry';
  return (
    <div
      className={`relative w-[160px] overflow-hidden rounded-2xl border bg-[#091229]/95 p-3 text-center shadow-2xl backdrop-blur-xl transition-all ${
        data.selected
          ? 'border-violet-400 shadow-[0_0_26px_-4px_rgba(139,92,246,0.6)] ring-1 ring-violet-300/40'
          : 'border-violet-500/35 hover:border-violet-400/80'
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-80" />
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-[#091229] !bg-violet-400"
      />
      <div className="mb-1.5 flex items-center justify-center gap-1 text-[10px] font-bold tracking-wide text-violet-300">
        <GitMerge className="h-3 w-3" />
        {isEntry ? '買い論理ゲート' : '売り論理ゲート'}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggle();
        }}
        title="クリックして AND / OR を切替"
        className={`w-full rounded-xl border px-2 py-1.5 font-mono text-[11px] font-bold transition ${
          data.gate === 'AND'
            ? 'border-violet-400/50 bg-violet-500/20 text-violet-100 shadow-[0_0_15px_-4px_rgba(139,92,246,0.5)] hover:bg-violet-500/30'
            : 'border-amber-400/50 bg-amber-500/20 text-amber-100 shadow-[0_0_15px_-4px_rgba(245,158,11,0.45)] hover:bg-amber-500/30'
        }`}
      >
        {data.gate === 'AND' ? 'AND（すべて満たす）' : 'OR（いずれか）'}
      </button>
      <div className="mt-1.5 font-mono text-[10px] text-slate-400">
        ACTIVE: {data.ruleCount}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-[#091229] !bg-violet-400"
      />
    </div>
  );
}

function ExecutionNode({ data }: NodeProps<Node<ExecutionNodeData>>) {
  const ex = data.strategy.execution;
  return (
    <div
      className={`relative w-[240px] overflow-hidden rounded-2xl border bg-[#081022]/95 p-3.5 shadow-2xl backdrop-blur-xl transition-all ${
        data.selected
          ? 'border-amber-400 shadow-[0_0_28px_-4px_rgba(251,191,36,0.55)] ring-1 ring-amber-300/40'
          : 'border-amber-500/30 hover:border-amber-400/75'
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80" />
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-[#081022] !bg-amber-400 !shadow-[0_0_10px_#fbbf24]"
      />
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-300">
          <ShieldCheck className="h-3 w-3" />
          執行 &amp; リスク管理
        </span>
        <span className="rounded bg-amber-950/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
          {ex.allowShort ? 'L/S' : 'LONG'} · {ex.leverage}x
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px] tabular-nums">
        <div className="rounded-lg border border-slate-800/80 bg-[#030712]/80 px-2 py-1.5">
          <div className="text-[10px] text-slate-400">損切り SL</div>
          <div className="font-mono font-bold text-rose-300">
            {ex.stopLossPct > 0 ? `-${ex.stopLossPct}%` : 'なし'}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800/80 bg-[#030712]/80 px-2 py-1.5">
          <div className="text-[10px] text-slate-400">利確 TP</div>
          <div className="font-mono font-bold text-emerald-300">
            {ex.takeProfitPct > 0 ? `+${ex.takeProfitPct}%` : 'なし'}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800/80 bg-[#030712]/80 px-2 py-1.5">
          <div className="text-[10px] text-slate-400">トレーリング</div>
          <div className="font-mono font-bold text-cyan-300">
            {ex.trailingStopPct > 0 ? `-${ex.trailingStopPct}%` : 'なし'}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800/80 bg-[#030712]/80 px-2 py-1.5">
          <div className="text-[10px] text-slate-400">投入比率</div>
          <div className="font-mono font-bold text-slate-100">{ex.positionSizePct}%</div>
        </div>
      </div>
    </div>
  );
}

const NODE_TYPES = {
  market: MarketNode,
  rule: RuleNode,
  gate: GateNode,
  execution: ExecutionNode,
};

export const VisualFlowBuilder: React.FC<VisualFlowBuilderProps> = ({
  strategy,
  barCount,
  selectedBlock,
  onSelectBlock,
  onToggleEntryLogic,
  onToggleExitLogic,
  onAddEntryRule,
  onAddExitRule,
}) => {
  const { nodes, edges } = useMemo(() => {
    const builtNodes: Node[] = [];
    const builtEdges: Edge[] = [];

    const entryCount = strategy.entryRules.length;
    const exitCount = strategy.exitRules.length;
    const rowHeight = 128;

    const entryStartY = 24;
    const entryCenterY = entryStartY + ((Math.max(1, entryCount) - 1) * rowHeight) / 2;

    const exitStartY = entryStartY + Math.max(1, entryCount) * rowHeight + 36;
    const exitCenterY = exitStartY + ((Math.max(1, exitCount) - 1) * rowHeight) / 2;

    const overallCenterY = (entryCenterY + exitCenterY) / 2;

    builtNodes.push({
      id: 'market',
      type: 'market',
      position: { x: 24, y: overallCenterY },
      data: {
        symbol: strategy.symbol,
        timeframe: strategy.timeframe,
        barCount,
        selected: selectedBlock.type === 'market',
      },
    });

    strategy.entryRules.forEach((rule, idx) => {
      const nodeId = `entry-${rule.id}`;
      builtNodes.push({
        id: nodeId,
        type: 'rule',
        position: { x: 295, y: entryStartY + idx * rowHeight },
        data: {
          kind: 'entry',
          rule,
          selected: selectedBlock.type === 'entry_rule' && selectedBlock.ruleId === rule.id,
        },
      });
      builtEdges.push({
        id: `e-market-${nodeId}`,
        source: 'market',
        target: nodeId,
        animated: rule.enabled,
        style: { stroke: rule.enabled ? '#38bdf8' : '#475569', strokeWidth: 2 },
      });
      builtEdges.push({
        id: `e-${nodeId}-gate`,
        source: nodeId,
        target: 'entry-gate',
        animated: rule.enabled,
        style: { stroke: rule.enabled ? '#10b981' : '#475569', strokeWidth: 2 },
      });
    });

    builtNodes.push({
      id: 'entry-gate',
      type: 'gate',
      position: { x: 615, y: entryCenterY + 10 },
      data: {
        kind: 'entry',
        gate: strategy.entryLogic,
        ruleCount: strategy.entryRules.filter((r) => r.enabled).length,
        selected: selectedBlock.type === 'entry_gate',
        onToggle: onToggleEntryLogic,
      },
    });

    strategy.exitRules.forEach((rule, idx) => {
      const nodeId = `exit-${rule.id}`;
      builtNodes.push({
        id: nodeId,
        type: 'rule',
        position: { x: 295, y: exitStartY + idx * rowHeight },
        data: {
          kind: 'exit',
          rule,
          selected: selectedBlock.type === 'exit_rule' && selectedBlock.ruleId === rule.id,
        },
      });
      builtEdges.push({
        id: `e-market-${nodeId}`,
        source: 'market',
        target: nodeId,
        animated: rule.enabled,
        style: { stroke: rule.enabled ? '#38bdf8' : '#475569', strokeWidth: 1.8, strokeDasharray: '5 4' },
      });
      builtEdges.push({
        id: `e-${nodeId}-gate`,
        source: nodeId,
        target: 'exit-gate',
        animated: rule.enabled,
        style: { stroke: rule.enabled ? '#f43f5e' : '#475569', strokeWidth: 2 },
      });
    });

    builtNodes.push({
      id: 'exit-gate',
      type: 'gate',
      position: { x: 615, y: exitCenterY + 10 },
      data: {
        kind: 'exit',
        gate: strategy.exitLogic,
        ruleCount: strategy.exitRules.filter((r) => r.enabled).length,
        selected: selectedBlock.type === 'exit_gate',
        onToggle: onToggleExitLogic,
      },
    });

    builtNodes.push({
      id: 'execution',
      type: 'execution',
      position: { x: 830, y: overallCenterY - 12 },
      data: {
        strategy,
        selected: selectedBlock.type === 'execution',
      },
    });

    builtEdges.push({
      id: 'e-entry-exec',
      source: 'entry-gate',
      target: 'execution',
      animated: true,
      label: 'BUY',
      labelStyle: { fill: '#6ee7b7', fontSize: 10, fontWeight: 700 },
      labelBgStyle: { fill: '#064e3b', fillOpacity: 0.9 },
      style: { stroke: '#10b981', strokeWidth: 2.5 },
    });

    builtEdges.push({
      id: 'e-exit-exec',
      source: 'exit-gate',
      target: 'execution',
      animated: true,
      label: 'EXIT',
      labelStyle: { fill: '#fda4af', fontSize: 10, fontWeight: 700 },
      labelBgStyle: { fill: '#4c0519', fillOpacity: 0.9 },
      style: { stroke: '#f43f5e', strokeWidth: 2.5 },
    });

    return { nodes: builtNodes, edges: builtEdges };
  }, [strategy, barCount, selectedBlock, onToggleEntryLogic, onToggleExitLogic]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    if (node.id === 'market') {
      onSelectBlock({ type: 'market' });
    } else if (node.id === 'execution') {
      onSelectBlock({ type: 'execution' });
    } else if (node.id === 'entry-gate') {
      onSelectBlock({ type: 'entry_gate' });
    } else if (node.id === 'exit-gate') {
      onSelectBlock({ type: 'exit_gate' });
    } else if (node.id.startsWith('entry-')) {
      onSelectBlock({ type: 'entry_rule', ruleId: node.id.replace('entry-', '') });
    } else if (node.id.startsWith('exit-')) {
      onSelectBlock({ type: 'exit_rule', ruleId: node.id.replace('exit-', '') });
    }
  };

  return (
    <div className="hud-panel flex h-[440px] w-full flex-col overflow-hidden rounded-2xl">
      {/* キャンバス上部ヘッダーバー（ノードと重ならない専用領域） */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 bg-[#050b18]/80 px-3.5 py-2.5">
        <div className="inline-flex items-center gap-2 text-xs text-slate-300">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-cyan-300/90">
            ALGO CIRCUIT
          </span>
          <span className="hidden text-slate-600 sm:inline">|</span>
          <span className="hidden text-xs text-slate-300 sm:inline">
            ブロックをクリックして右側で編集（即時バックテスト反映）
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddEntryRule}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:shadow-[0_0_16px_-4px_rgba(16,185,129,0.6)]"
          >
            <Plus className="h-3.5 w-3.5" />
            買いブロック追加
          </button>
          <button
            type="button"
            onClick={onAddExitRule}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 hover:shadow-[0_0_16px_-4px_rgba(244,63,94,0.6)]"
          >
            <Plus className="h-3.5 w-3.5" />
            売りブロック追加
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-[#030712]/90">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          minZoom={0.45}
          maxZoom={1.4}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.3}
            color="rgba(56, 189, 248, 0.22)"
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
};
