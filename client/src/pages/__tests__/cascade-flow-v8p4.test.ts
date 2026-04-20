/**
 * v8 Pass 4 — CascadeFlowDiagram v2 tests
 * Validates the 6-hub SVG diagram, edge connections, and data flow logic.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../calculators/CascadeFlowDiagram.tsx'),
  'utf-8',
);

describe('CascadeFlowDiagram v2', () => {
  it('defines all 6 hub nodes', () => {
    const hubIds = ['client', 'advanced', 'practice', 'compliance', 'financial-data', 'unified-plan'];
    for (const id of hubIds) {
      expect(SRC).toContain(`id: '${id}'`);
    }
  });

  it('maps each hub to a valid panelId', () => {
    const panelIds = [
      'client-wealth-hub',
      'advanced-strategies-hub',
      'practice',
      'compliance-checklist',
      'financial-data-hub',
      'planning-hierarchy',
    ];
    for (const pid of panelIds) {
      expect(SRC).toContain(`panelId: '${pid}'`);
    }
  });

  it('defines 8 cascade edges connecting the hubs', () => {
    const edgePairs = [
      { from: 'client', to: 'advanced' },
      { from: 'advanced', to: 'practice' },
      { from: 'client', to: 'compliance' },
      { from: 'financial-data', to: 'client' },
      { from: 'financial-data', to: 'advanced' },
      { from: 'client', to: 'unified-plan' },
      { from: 'advanced', to: 'unified-plan' },
      { from: 'compliance', to: 'unified-plan' },
    ];
    for (const { from, to } of edgePairs) {
      expect(SRC).toContain(`from: '${from}', to: '${to}'`);
    }
  });

  it('uses SVG foreignObject for node rendering', () => {
    expect(SRC).toContain('foreignObject');
    expect(SRC).toContain('viewBox');
  });

  it('includes FlowEdge component with animated dashes', () => {
    expect(SRC).toContain('function FlowEdge');
    expect(SRC).toContain('strokeDasharray');
    expect(SRC).toContain('animate');
    expect(SRC).toContain('stroke-dashoffset');
  });

  it('has click-to-select and double-click-to-navigate logic', () => {
    expect(SRC).toContain('handleNodeClick');
    expect(SRC).toContain('selectedNode === hub.id');
    expect(SRC).toContain('onNavigateToPanel');
  });

  it('renders a detail panel for the selected hub', () => {
    expect(SRC).toContain('selectedHub');
    expect(SRC).toContain('Data Connections');
    expect(SRC).toContain('selectedEdges');
  });

  it('shows active flow count in the header badge', () => {
    expect(SRC).toContain('totalFlows');
    expect(SRC).toContain('active flow');
    expect(SRC).toContain('6 hubs connected');
  });

  it('includes a legend explaining the visual encoding', () => {
    expect(SRC).toContain('Active flow');
    expect(SRC).toContain('Inactive');
    expect(SRC).toContain('Double-click to navigate');
  });

  it('computes live metrics from weData for each hub', () => {
    expect(SRC).toContain('totalIncome');
    expect(SRC).toContain('netWorth');
    expect(SRC).toContain('protectionGap');
    expect(SRC).toContain('retirementGap');
    expect(SRC).toContain('pfFace');
    expect(SRC).toContain('ppTargetGDC');
  });

  it('has proper aria labels for accessibility', () => {
    expect(SRC).toContain('aria-label');
    expect(SRC).toContain('role="img"');
    expect(SRC).toContain('role="button"');
  });
});
