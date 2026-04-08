/**
 * GuardrailsGauge — semicircular gauge showing current portfolio value
 * vs the lower/upper guardrail thresholds. Animates needle to position
 * on mount (800ms spring) unless reduced-motion is on.
 *
 * Spec mapping: v7 "v-retire" panel's Guardrails mode. Replicated in
 * React SVG so it renders identically to the HTML version.
 */

import { useMemo } from "react";
import { chartTokens } from "@/lib/wealth-engine/tokens";
import {
  formatCurrency,
  useReducedMotion,
  useCountUp,
  linearScale,
} from "@/lib/wealth-engine/animations";

export interface GuardrailsGaugeProps {
  currentValue: number;
  lowerThreshold: number;
  upperThreshold: number;
  targetValue?: number;
  width?: number;
  label?: string;
}

export function GuardrailsGauge({
  currentValue,
  lowerThreshold,
  upperThreshold,
  targetValue,
  width = 360,
  label = "Portfolio vs Guardrails",
}: GuardrailsGaugeProps) {
  const reduced = useReducedMotion();
  const animated = useCountUp(currentValue, { enabled: !reduced });

  const {
    cx,
    cy,
    radius,
    lowerAngle,
    upperAngle,
    needleAngle,
    backArcD,
    safeArcD,
    zoneColor,
  } = useMemo(() => {
    const svgW = width;
    const svgH = width * 0.6;
    const cx = svgW / 2;
    const cy = svgH * 0.85;
    const radius = svgW * 0.4;

    // Domain: 60%..140% of midpoint covers the normal operating range
    const mid = (lowerThreshold + upperThreshold) / 2;
    const domainMin = Math.min(currentValue, lowerThreshold * 0.6, mid * 0.6);
    const domainMax = Math.max(currentValue, upperThreshold * 1.2, mid * 1.4);

    // Map domain value to angle [-90°, +90°]
    const angleFor = (v: number) =>
      linearScale(v, domainMin, domainMax, -Math.PI / 2, Math.PI / 2);
    const lowerAngle = angleFor(lowerThreshold);
    const upperAngle = angleFor(upperThreshold);
    const needleAngle = angleFor(animated);

    // Build arc paths
    const arcPoint = (theta: number) => ({
      x: cx + radius * Math.sin(theta),
      y: cy - radius * Math.cos(theta),
    });
    const back = `M${arcPoint(-Math.PI / 2).x} ${arcPoint(-Math.PI / 2).y} A ${radius} ${radius} 0 0 1 ${arcPoint(Math.PI / 2).x} ${arcPoint(Math.PI / 2).y}`;
    const safe = `M${arcPoint(lowerAngle).x} ${arcPoint(lowerAngle).y} A ${radius} ${radius} 0 0 1 ${arcPoint(upperAngle).x} ${arcPoint(upperAngle).y}`;

    // Zone color: green inside thresholds, amber near edge, red outside
    let color: string = chartTokens.colors.positive;
    if (currentValue < lowerThreshold || currentValue > upperThreshold) {
      color = chartTokens.colors.danger;
    } else if (
      currentValue < lowerThreshold * 1.05 ||
      currentValue > upperThreshold * 0.95
    ) {
      color = chartTokens.colors.warning;
    }

    return {
      cx,
      cy,
      radius,
      lowerAngle,
      upperAngle,
      needleAngle,
      backArcD: back,
      safeArcD: safe,
      zoneColor: color,
    };
  }, [animated, lowerThreshold, upperThreshold, width, currentValue]);

  return (
    <div className="w-full" style={{ maxWidth: width }}>
      <svg
        viewBox={`0 0 ${width} ${width * 0.75}`}
        width="100%"
        role="img"
        aria-label={label}
      >
        {/* Background arc */}
        <path
          d={backArcD}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* Safe zone arc */}
        <path
          d={safeArcD}
          fill="none"
          stroke={chartTokens.colors.positive}
          strokeWidth={12}
          strokeLinecap="round"
        />

        {/* Threshold markers */}
        {[lowerAngle, upperAngle].map((a, i) => (
          <line
            key={i}
            x1={cx + radius * Math.sin(a) * 0.92}
            y1={cy - radius * Math.cos(a) * 0.92}
            x2={cx + radius * Math.sin(a) * 1.08}
            y2={cy - radius * Math.cos(a) * 1.08}
            stroke="#334155"
            strokeWidth={2}
          />
        ))}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + radius * 0.85 * Math.sin(needleAngle)}
          y2={cy - radius * 0.85 * Math.cos(needleAngle)}
          stroke={zoneColor}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={8} fill={zoneColor} />

        {/* Labels */}
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          fontSize={18}
          fontWeight={700}
          fill={zoneColor}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatCurrency(animated)}
        </text>
        <text
          x={cx}
          y={cy + 48}
          textAnchor="middle"
          fontSize={11}
          fill="#64748b"
        >
          {label}
        </text>
        <text
          x={cx + radius * Math.sin(lowerAngle)}
          y={cy - radius * Math.cos(lowerAngle) + 28}
          textAnchor="middle"
          fontSize={10}
          fill="#64748b"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatCurrency(lowerThreshold)}
        </text>
        <text
          x={cx + radius * Math.sin(upperAngle)}
          y={cy - radius * Math.cos(upperAngle) + 28}
          textAnchor="middle"
          fontSize={10}
          fill="#64748b"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatCurrency(upperThreshold)}
        </text>
        {targetValue !== undefined && (
          <text
            x={cx}
            y={cy + 66}
            textAnchor="middle"
            fontSize={11}
            fill="#64748b"
          >
            Target {formatCurrency(targetValue)}
          </text>
        )}
      </svg>
    </div>
  );
}
