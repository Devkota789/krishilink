import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

// AnimatedEye: open eye with subtle breathing + pupil drift + periodic blink when count>0; closed pulsing line when 0.
const AnimatedEye = ({ count = 0, size = 14 }) => {
  const isOpen = count > 0;
  const prefersReducedMotion = useReducedMotion();

  const blinkTransition = useMemo(
    () => ({
      times: [0, 0.74, 0.76, 1, 1.74, 1.76, 2],
      duration: 4,
      repeat: Infinity,
      ease: "linear",
    }),
    []
  );

  const drift = prefersReducedMotion
    ? {}
    : {
        x: [0, 0.8, -0.6, 0.4, 0],
        y: [0, -0.4, 0.4, -0.2, 0],
        transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
      };
  const breathe = prefersReducedMotion
    ? {}
    : {
        scale: [1, 1.05, 1],
        transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
      };
  const idlePulse = prefersReducedMotion
    ? {}
    : {
        opacity: [0.7, 1, 0.7],
        transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
      };

  const w = size * 2;
  const h = size * 1.4;
  const stroke = 1.6;

  if (!isOpen) {
    // Closed eye: dual curves (upper & lower) forming a slim almond outline with traveling highlight.
    return (
      <motion.svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="No active viewers"
        style={{ display: "block" }}
        {...idlePulse}
      >
        <defs>
          <linearGradient
            id="eyeClosedGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#5cc4ff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.25" />
          </linearGradient>
          <filter
            id="eyeClosedGlow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="1.15"
              result="blur"
            />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Upper subtle shadow */}
        <motion.path
          d={`M4 ${h / 2} Q ${w / 2} ${h / 2 - h * 0.34} ${w - 4} ${h / 2}`}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.18}
          strokeWidth={stroke * 1.05}
          strokeLinecap="round"
        />
        {/* Upper lid main */}
        <motion.path
          d={`M4 ${h / 2} Q ${w / 2} ${h / 2 - h * 0.4} ${w - 4} ${h / 2}`}
          fill="none"
          stroke="url(#eyeClosedGradient)"
          strokeWidth={stroke * 1.25}
          strokeLinecap="round"
          filter="url(#eyeClosedGlow)"
          pathLength={1}
          strokeDasharray={1}
          animate={{ strokeDashoffset: [0, -1] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "linear" }}
        />
        {/* Lower subtle shadow */}
        <motion.path
          d={`M4 ${h / 2} Q ${w / 2} ${h / 2 + h * 0.34} ${w - 4} ${h / 2}`}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.14}
          strokeWidth={stroke * 0.95}
          strokeLinecap="round"
        />
        {/* Lower lid main with opposite travel direction */}
        <motion.path
          d={`M4 ${h / 2} Q ${w / 2} ${h / 2 + h * 0.4} ${w - 4} ${h / 2}`}
          fill="none"
          stroke="url(#eyeClosedGradient)"
          strokeWidth={stroke * 1.15}
          strokeLinecap="round"
          filter="url(#eyeClosedGlow)"
          pathLength={1}
          strokeDasharray={1}
          animate={{ strokeDashoffset: [0, 1] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "linear" }}
        />
        {/* Gentle micro squeeze animation so the two curves breathe subtly */}
        {!prefersReducedMotion && (
          <motion.g
            style={{ originX: "50%", originY: "50%" }}
            animate={{ scaleY: [1, 0.94, 1] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.svg>
    );
  }

  return (
    <motion.svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${count} active viewer${count === 1 ? "" : "s"}`}
      style={{ display: "block" }}
      {...breathe}
    >
      <path
        d={`M2 ${h / 2} Q ${w / 2} ${-h * 0.15} ${w - 2} ${h / 2} Q ${w / 2} ${
          h + h * 0.15
        } 2 ${h / 2} Z`}
        fill="#ffffff11"
        stroke="#ffffff"
        strokeWidth={stroke}
      />
      <motion.circle
        cx={w / 2}
        cy={h / 2}
        r={h * 0.26}
        fill="#5cc4ff"
        stroke="#ffffff"
        strokeWidth={stroke * 0.4}
        {...drift}
      />
      <motion.circle
        cx={w / 2}
        cy={h / 2}
        r={h * 0.14}
        fill="#0b1e30"
        {...drift}
      />
      <motion.circle
        cx={w / 2 - h * 0.08}
        cy={h / 2 - h * 0.08}
        r={h * 0.06}
        fill="#ffffffcc"
        opacity={0.9}
        {...drift}
      />
      {!prefersReducedMotion && (
        <motion.rect
          x={0}
          y={0}
          width={w}
          height={h}
          fill="#0b1e30"
          style={{ originY: 0.5 }}
          animate={{ scaleY: [1, 1, 0, 1, 1, 0, 1] }}
          transition={blinkTransition}
          opacity={0.04}
        />
      )}
    </motion.svg>
  );
};

export default AnimatedEye;
