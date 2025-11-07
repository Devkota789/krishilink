import React from "react";
import "./Footer.css";

const Footer = () => (
  <footer className="footer">
    {/* Removed side leaves per request */}
    {/* Farmer journey animation moved from navbar */}
    <div className="footer-farmer-journey" aria-hidden="true">
      <svg
        className="footer-farmer-svg"
        viewBox="0 0 320 70"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="fHat" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#fbc02d" />
            <stop offset="100%" stopColor="#fdd835" />
          </linearGradient>
          <linearGradient id="fShirt" x1="0" x2="1">
            <stop offset="0%" stopColor="#2e7d32" />
            <stop offset="100%" stopColor="#4caf50" />
          </linearGradient>
          <linearGradient id="fCart" x1="0" x2="1">
            <stop offset="0%" stopColor="#8d6e63" />
            <stop offset="100%" stopColor="#5d4037" />
          </linearGradient>
          <linearGradient id="fProduceRed" x1="0" x2="1">
            <stop offset="0%" stopColor="#d84315" />
            <stop offset="100%" stopColor="#ff7043" />
          </linearGradient>
          <linearGradient id="fProduceOrange" x1="0" x2="1">
            <stop offset="0%" stopColor="#ef6c00" />
            <stop offset="100%" stopColor="#ffb74d" />
          </linearGradient>
          <linearGradient id="fProduceLeaf" x1="0" x2="1">
            <stop offset="0%" stopColor="#2e7d32" />
            <stop offset="100%" stopColor="#81c784" />
          </linearGradient>
          <linearGradient id="fProduceYellow" x1="0" x2="1">
            <stop offset="0%" stopColor="#f9a825" />
            <stop offset="100%" stopColor="#ffeb3b" />
          </linearGradient>
          <linearGradient id="fProducePurple" x1="0" x2="1">
            <stop offset="0%" stopColor="#6a1b9a" />
            <stop offset="100%" stopColor="#ab47bc" />
          </linearGradient>
        </defs>
        <g className="footer-farmer-group" data-force-motion="true">
          <ellipse className="footer-shadow" cx="40" cy="60" rx="34" ry="6" />
          <g className="footer-cart" transform="translate(-20,0)">
            <rect
              x="0"
              y="30"
              width="48"
              height="18"
              rx="3"
              fill="url(#fCart)"
              stroke="#4e342e"
              strokeWidth="1"
            />
            <rect
              x="4"
              y="26"
              width="40"
              height="8"
              rx="2"
              fill="#6d4c41"
              stroke="#4e342e"
              strokeWidth="0.8"
            />
            <g className="footer-wheel footer-wheel-l">
              <circle
                cx="12"
                cy="52"
                r="6.5"
                fill="#3e2723"
                stroke="#795548"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="52" r="2.2" fill="#5d4037" />
            </g>
            <g className="footer-wheel footer-wheel-r">
              <circle
                cx="36"
                cy="52"
                r="6.5"
                fill="#3e2723"
                stroke="#795548"
                strokeWidth="1.5"
              />
              <circle cx="36" cy="52" r="2.2" fill="#5d4037" />
            </g>
            <rect
              x="6"
              y="20"
              width="36"
              height="10"
              rx="2"
              fill="#4e342e"
              stroke="#3e2723"
              strokeWidth="0.8"
            />
            <line
              x1="6"
              y1="24"
              x2="42"
              y2="24"
              stroke="#6d4c41"
              strokeWidth="1"
            />
            <g className="footer-produce">
              <ellipse
                cx="14"
                cy="20"
                rx="6"
                ry="5"
                fill="url(#fProduceOrange)"
                stroke="#e65100"
                strokeWidth="0.8"
              />
              <ellipse
                cx="24"
                cy="19"
                rx="5"
                ry="4.5"
                fill="url(#fProduceRed)"
                stroke="#bf360c"
                strokeWidth="0.8"
              />
              <ellipse
                cx="33"
                cy="20"
                rx="6"
                ry="5"
                fill="url(#fProduceLeaf)"
                stroke="#2e7d32"
                strokeWidth="0.8"
              />
              {/* Extra produce for fuller cart */}
              <ellipse
                cx="20"
                cy="16.5"
                rx="4"
                ry="3.3"
                fill="url(#fProduceLeaf)"
                stroke="#2e7d32"
                strokeWidth="0.6"
              />
              <ellipse
                cx="28"
                cy="15.5"
                rx="4.2"
                ry="3.4"
                fill="url(#fProduceOrange)"
                stroke="#e65100"
                strokeWidth="0.6"
              />
              {/* Additional layer (back row) */}
              <ellipse
                cx="11"
                cy="17"
                rx="3.6"
                ry="3"
                fill="url(#fProducePurple)"
                stroke="#4a148c"
                strokeWidth="0.5"
              />
              <ellipse
                cx="24"
                cy="15.2"
                rx="3.3"
                ry="2.8"
                fill="url(#fProduceYellow)"
                stroke="#f57f17"
                strokeWidth="0.5"
              />
              <ellipse
                cx="34.5"
                cy="16"
                rx="3.8"
                ry="3.1"
                fill="url(#fProduceRed)"
                stroke="#bf360c"
                strokeWidth="0.55"
              />
              <ellipse
                cx="17"
                cy="15.2"
                rx="2.9"
                ry="2.4"
                fill="url(#fProduceYellow)"
                stroke="#f57f17"
                strokeWidth="0.45"
              />
              <path
                d="M24 14 q2 -3 5 -2 q-2 3 -5 2Z"
                fill="#66bb6a"
                stroke="#2e7d32"
                strokeWidth="0.6"
              />
              <path
                d="M14 15 q2 -4 4 -2 q-1 3 -4 2Z"
                fill="#81c784"
                stroke="#2e7d32"
                strokeWidth="0.6"
              />
              <path
                d="M33 14 q3 -3 5 -1 q-2 3 -5 1Z"
                fill="#66bb6a"
                stroke="#2e7d32"
                strokeWidth="0.6"
              />
            </g>
          </g>
          <g
            className="footer-farmer seated"
            transform="translate(18,-4) scale(0.9)"
          >
            <rect
              x="4"
              y="36"
              width="22"
              height="5"
              rx="2"
              fill="#6d4c41"
              stroke="#4e342e"
              strokeWidth="0.6"
            />
            <g className="farmer-seated">
              {/* Hat (unchanged) */}
              <path
                d="M4 20 l10 -4 11 3 -3 5 -15 0z"
                fill="url(#fHat)"
                stroke="#f57f17"
                strokeWidth="1"
              />
              {/* Hair/back head shadow */}
              <path
                d="M8 22 q4 -4 9 -1 q-4 0 -5 3 q-2 1 -4 -2Z"
                fill="#5d4037"
                opacity="0.55"
              />
              {/* Side-facing head */}
              <g className="farmer-head side">
                <ellipse
                  cx="13"
                  cy="27.5"
                  rx="6"
                  ry="7"
                  fill="#ffe0b2"
                  stroke="#ffcc80"
                  strokeWidth="1"
                />
                {/* Ear (back) */}
                <circle
                  cx="8.2"
                  cy="28"
                  r="1.2"
                  fill="#ffcc80"
                  stroke="#f5b97d"
                  strokeWidth="0.4"
                />
                {/* Eye (looking forward) */}
                <circle cx="16" cy="26.5" r="0.8" fill="#5d4037" />
                {/* Nose silhouette */}
                <path
                  d="M18.2 27 q1 .8 0 1.8"
                  stroke="#e0a572"
                  strokeWidth="0.7"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
              {/* Torso */}
              <rect
                x="8"
                y="33"
                width="11"
                height="17"
                rx="3"
                className="farmer-torso"
                fill="url(#fShirt)"
              />
              {/* Arms (slight steering sway) */}
              <g className="footer-arm arm-back">
                <path
                  d="M10 38 l-5 4"
                  stroke="#2e7d32"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g className="footer-arm arm-front">
                <path
                  d="M16 38 l7 3"
                  stroke="#2e7d32"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              {/* Animated legs */}
              <g className="footer-leg leg-back">
                <path
                  d="M11 50 q-4 6 -2 12"
                  stroke="#1b5e20"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g className="footer-leg leg-front">
                <path
                  d="M15 50 q4 6 2 12"
                  stroke="#1b5e20"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
    <div className="footer-road" aria-hidden="true" />
    <div className="footer-content">
      <p>
        &copy; {new Date().getFullYear()} Krishilink Nepal. All rights reserved.
      </p>
    </div>
  </footer>
);

export default Footer;
