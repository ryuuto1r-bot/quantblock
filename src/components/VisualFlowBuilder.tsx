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
      className={`w-[215px] rounded-xl border bg-[#0d1424]/95 p-3.5 shadow-xl backdrop-blur transition-all ${
        data.selected
          ? 'border-sky-400 ring-2 ring-sky-500/30'
          : 'border-slate-700/80 hover:border-sky-500/60'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
          <Database className="h-3.5 w-3.5" />
          マーケットデータ
        </span>
        <span className="font-mono text-[11px] text-slate-400">{data.timeframe}</span>
      </div>
      <div className="font-mono text-base font-bold tracking-tight text-white">
        {data.symbol}
      </div>
      <div className="mt-1 text-[11px] text-slate-400 tabular-nums">
        過去 {data.barCount.toLocaleString()} 本のOHLCV
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-[#0d1424] !bg-sky-400"
      />
    </div>
  );
}

function RuleNode({ data }: NodeProps<Node<RuleNodeData>>) {
  const isEntry = data.kind === 'entry';
  const accentBorder = data.selected
    ? isEntry
      ? 'border-emerald-400 ring-2 ring-emerald-500/30'
      : 'border-rose-400 ring-2 ring-rose-500/30'
    : isEntry
    ? 'border-emerald-500/35 hover:border-emerald-400/70'
    : 'border-rose-500/35 hover:border-rose-400/70';

  return (
    <div
      className={`w-[255px] rounded-xl border bg-[#0e1629]/95 p-3.5 shadow-xl transition-all ${accentBorder} ${
        !data.rule.enabled ? 'opacity-45 grayscale' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={`!h-2.5 !w-2.5 !border-2 !border-[#0e1629] ${
          isEntry ? '!bg-emerald-400' : '!bg-rose-400'
        }`}
      />
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            isEntry
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-rose-500/15 text-rose-300'
          }`}
        >
          {isEntry ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {isEntry ? '買い条件ブロック' : '売り条件ブロック'}
        </span>
        {!data.rule.enabled && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            OFF
          </span>
        )}
      </div>
      <div className="text-xs font-semibold text-slate-200">{data.rule.label}</div>
      <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-indigo-200">
        {ruleToNaturalJapanese(data.rule)}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className={`!h-2.5 !w-2.5 !border-2 !border-[#0e1629] ${
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
      className={`w-[155px] rounded-xl border bg-[#11192e]/95 p-3 text-center shadow-xl transition-all ${
        data.selected
          ? 'border-indigo-400 ring-2 ring-indigo-500/30'
          : 'border-indigo-500/35 hover:border-indigo-400/70'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-[#11192e] !bg-indigo-400"
      />
      <div className="mb-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-indigo-300">
        <GitMerge className="h-3.5 w-3.5" />
        {isEntry ? '買い論理ゲート' : '売り論理ゲート'}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggle();
        }}
        title="クリックして AND / OR を切替"
        className={`w-full rounded-lg border px-2 py-1.5 font-mono text-xs font-bold transition ${
          data.gate === 'AND'
            ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30'
            : 'border-amber-400/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
        }`}
      >
        {data.gate === 'AND' ? 'AND（すべて満たす）' : 'OR（いずれか）'}
      </button>
      <div className="mt-1 text-[10px] text-slate-400">
        有効条件: {data.ruleCount} 個
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-[#11192e] !bg-indigo-400"
      />
    </div>
  );
}

function ExecutionNode({ data }: NodeProps<Node<ExecutionNodeData>>) {
  const ex = data.strategy.execution;
  return (
    <div
      className={`w-[235px] rounded-xl border bg-[#0f172a]/95 p-3.5 shadow-xl transition-all ${
        data.selected
          ? 'border-amber-400 ring-2 ring-amber-500/30'
          : 'border-amber-500/35 hover:border-amber-400/70'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-[#0f172a] !bg-amber-400"
      />
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          執行 &amp; リスク管理
        </span>
        <span className="font-mono text-[10px] font-bold text-amber-300">
          {ex.allowShort ? 'L/S' : 'LONG'} · {ex.leverage}x
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px] tabular-nums">
        <div className="rounded bg-slate-900/90 px-2 py-1">
          <div className="text-[10px] text-slate-400">損切り SL</div>
          <div className="font-mono font-semibold text-rose-300">
            {ex.stopLossPct > 0 ? `-${ex.stopLossPct}%` : 'なし'}
          </div>
        </div>
        <div className="rounded bg-slate-900/90 px-2 py-1">
          <div className="text-[10px] text-slate-400">利確 TP</div>
          <div className="font-mono font-semibold text-emerald-300">
            {ex.takeProfitPct > 0 ? `+${ex.takeProfitPct}%` : 'なし'}
          </div>
        </div>
        <div className="rounded bg-slate-900/90 px-2 py-1">
          <div className="text-[10px] text-slate-400">トレーリング</div>
          <div className="font-mono font-semibold text-sky-300">
            {ex.trailingStopPct > 0 ? `-${ex.trailingStopPct}%` : 'なし'}
          </div>
        </div>
        <div className="rounded bg-slate-900/90 px-2 py-1">
          <div className="text-[10px] text-slate-400">投入比率</div>
          <div className="font-mono font-semibold text-slate-200">{ex.positionSizePct}%</div>
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
    <div className="flex h-[440px] w-full flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-[#080d19]">
      {/* キャンバス上部ヘッダーバー（ノードと重ならない専用領域） */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 bg-[#0b1220] px-3.5 py-2.5">
        <div className="inline-flex items-center gap-2 text-xs text-slate-300">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
          <span>ブロックをクリックして右側で編集（即時バックテスト反映）</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddEntryRule}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            買いブロック追加
          </button>
          <button
            type="button"
            onClick={onAddExitRule}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            売りブロック追加
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
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
            gap={20}
            size={1.2}
            color="#1e293b"
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
};
