import React from 'react';

interface RebarBundleIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  glow?: boolean;
}

export default function RebarBundleIcon({ 
  size = 48, 
  className = '', 
  glow = true,
  ...props 
}: RebarBundleIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 64 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      {...props}
    >
      <defs>
        {/* Steel rebar rod gradients */}
        <linearGradient id="rebar-steel-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="50%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        <linearGradient id="rebar-highlight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        <linearGradient id="rebar-gold-band" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>

        {/* Ambient indicator glow */}
        <filter id="isometric-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Glow highlight background */}
      {glow && (
        <circle 
          cx="32" 
          cy="32" 
          r="26" 
          fill="#38bdf8" 
          fillOpacity="0.04" 
          filter="url(#isometric-glow)" 
        />
      )}

      {/* Outer Smart Target HUD rings */}
      <circle 
        cx="32" 
        cy="32" 
        r="28" 
        stroke="#1e293b" 
        strokeWidth="1" 
        strokeDasharray="4 6" 
      />
      <circle 
        cx="32" 
        cy="32" 
        r="24" 
        stroke="#38bdf8" 
        strokeWidth="1.5" 
        strokeOpacity="0.25" 
      />

      <g transform="translate(1, -1)">
        {/* Supporting Isometric shadow */}
        <ellipse 
          cx="31" 
          cy="48" 
          rx="18" 
          ry="6" 
          fill="#020617" 
          fillOpacity="0.65" 
        />

        {/* REBAR BARS (3 clustered isometric cylinders) */}
        
        {/* Rod 1 (Bottom Left) */}
        <g id="rod-bottom-left">
          {/* Cylinder Body */}
          <path 
            d="M17 38 L37 26 L47 32 L27 44 Z" 
            fill="url(#rebar-steel-primary)" 
            stroke="#1e293b" 
            strokeWidth="1" 
          />
          {/* Isometric Ribbed Markings */}
          <path d="M22 35 L25 37 M26 33 L29 35 M30 31 L33 33 M34 29 L37 31" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M25 39 L28 41 M29 37 L32 39 M33 35 L36 37 M37 33 L40 35" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
          {/* Front Ellipse cap */}
          <ellipse cx="27" cy="44" rx="5" ry="3" fill="#64748b" stroke="#0f172a" strokeWidth="1" />
          <ellipse cx="27" cy="44" rx="3.2" ry="2" fill="url(#rebar-highlight)" />
        </g>

        {/* Rod 2 (Bottom Right) */}
        <g id="rod-bottom-right">
          {/* Cylinder Body */}
          <path 
            d="M25 42 L45 30 L55 36 L35 48 Z" 
            fill="url(#rebar-steel-primary)" 
            stroke="#1e293b" 
            strokeWidth="1" 
          />
          {/* Isometric Ribbed Markings */}
          <path d="M30 39 L33 41 M34 37 L37 39 M38 35 L41 37 M42 33 L45 35" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <path d="M33 43 L36 45 M37 41 L40 43 M41 39 L44 41 M45 37 L48 39" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
          {/* Front Ellipse cap */}
          <ellipse cx="35" cy="48" rx="5" ry="3" fill="#475569" stroke="#0f172a" strokeWidth="1" />
          <ellipse cx="35" cy="48" rx="3.2" ry="2" fill="url(#rebar-highlight)" />
        </g>

        {/* Rod 3 (Top Center) */}
        <g id="rod-top-center">
          {/* Cylinder Body */}
          <path 
            d="M21 32 L41 20 L51 26 L31 38 Z" 
            fill="url(#rebar-steel-primary)" 
            stroke="#1e293b" 
            strokeWidth="1" 
          />
          {/* Isometric Ribbed Markings */}
          <path d="M26 29 L29 31 M30 27 L33 29 M34 25 L37 27 M38 23 L41 25" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M29 33 L32 35 M33 31 L36 33 M37 29 L40 31 M41 27 L44 29" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
          {/* Front Ellipse cap */}
          <ellipse cx="31" cy="38" rx="5" ry="3" fill="#94a3b8" stroke="#0f172a" strokeWidth="1" />
          <ellipse cx="31" cy="38" rx="3.2" ry="2" fill="url(#rebar-highlight)" />
        </g>

        {/* Secure steel heavy tie-straps wrapping the isometric bundle */}
        <g id="bundle-ties">
          {/* Strap A (Back-End) */}
          <path 
            d="M22.5 28.5 L24 29.5 L24.5 31.5 L22 30.5 Z" 
            fill="url(#rebar-gold-band)" 
            stroke="#451a03" 
            strokeWidth="0.5" 
          />
          {/* Strap B (Front-End) */}
          <path 
            d="M39.5 32 L41.5 33 L42 35 L40.5 34.2 Z" 
            fill="url(#rebar-gold-band)" 
            stroke="#451a03" 
            strokeWidth="0.5" 
          />
        </g>

        {/* Telemetry Target reticle indicators */}
        <path d="M12 25 L12 20 L17 20" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" />
        <path d="M50 40 L50 45 L45 45" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  );
}
