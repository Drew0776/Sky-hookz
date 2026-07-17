import React from 'react';
import { machineLegendItems, heatmapLegendItems } from '../pages/yardMapData';

interface YardMapLegendProps {
  isHeatmapMode: boolean;
  getHeatmapCategoryWeight: (id: string) => number;
  getHeatmapCategoryZones: (id: string) => any[];
  getMachineCategoryWeight: (id: string) => number;
}

export default function YardMapLegend({
  isHeatmapMode,
  getHeatmapCategoryWeight,
  getHeatmapCategoryZones,
  getMachineCategoryWeight
}: YardMapLegendProps) {
  return (
    <div>
      {isHeatmapMode ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" id="heatmap-weight-legend">
          {heatmapLegendItems.map((item) => (
            <div 
              key={item.id} 
              className="relative group cursor-help flex items-start gap-2 p-2.5 rounded-lg bg-slate-950/40 border border-slate-900/85 hover:bg-slate-950/60 transition-all font-mono"
            >
              <span className={`h-4 w-4 rounded border ${item.borderClass} ${item.bgClass} ${item.colorClass} flex items-center justify-center shrink-0 mt-0.5`}>
                <span className={`h-1.5 w-1.5 rounded-full ${item.dotClass}`}></span>
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-200 block uppercase tracking-wide leading-none">{item.name}</span>
                <span className="text-[9px] text-slate-500 block mt-1 leading-normal">{item.desc}</span>
                
                <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono border-t border-slate-900/65 pt-1.5">
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider">Total Wt:</span>
                  <span className="text-amber-400 font-extrabold font-mono">
                    {item.id === 'empty' 
                      ? '0 LBS' 
                      : `${getHeatmapCategoryWeight(item.id).toLocaleString()} LBS`}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] text-slate-500">
                  <span className="uppercase tracking-wider">Sectors:</span>
                  <span className="font-extrabold text-slate-300 font-mono">
                    {getHeatmapCategoryZones(item.id).length} zones
                  </span>
                </div>
              </div>

              {/* Premium Dynamic Heatmap Tooltip */}
              {item.info && (
                <div className={`absolute bottom-full mb-3.5 w-64 p-3 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 scale-95 group-hover:scale-100 flex flex-col gap-2 font-sans text-left backdrop-blur-md ${item.tooltipAlign}`}>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10px] font-extrabold text-white uppercase tracking-wider">{item.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono uppercase font-bold ${item.info.statusClass}`}>
                      {item.info.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono text-slate-400">
                    <div>
                      <span className="text-slate-500 block uppercase text-[7px] font-bold">Capacity Metric:</span>
                      <span className="text-amber-500 font-bold">{item.info.metric}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[7px] font-bold">Staging Action:</span>
                      <span className="text-slate-200 font-bold">{item.info.action}</span>
                    </div>
                    <div className="col-span-2 mt-1">
                      <span className="text-slate-500 block uppercase text-[7px] font-bold">Coordinator:</span>
                      <span className="text-slate-200 font-bold">{item.info.technician}</span>
                    </div>
                    <div className="col-span-2 mt-1 border-t border-slate-800/60 pt-1 text-[8px] text-slate-500 leading-relaxed italic">
                      {item.info.note}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {machineLegendItems.map((item) => (
            <div 
              key={item.id} 
              className="relative group cursor-help flex items-start gap-2 p-2.5 rounded-lg bg-slate-950/40 border border-slate-900/85 hover:bg-slate-950/60 transition-all font-mono"
            >
              <span className={`h-4 w-4 rounded border ${item.borderClass} ${item.bgClass} ${item.colorClass} flex items-center justify-center shrink-0 mt-0.5`}>
                <span className={`h-1.5 w-1.5 rounded-full ${item.dotClass}`}></span>
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-200 block uppercase tracking-wide leading-none">{item.name}</span>
                <span className="text-[9px] text-slate-500 block mt-1 leading-normal">{item.desc}</span>
                
                <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono border-t border-slate-900/65 pt-1.5">
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider">Total Wt:</span>
                  <span className="text-amber-400 font-extrabold font-mono">{getMachineCategoryWeight(item.id).toLocaleString()} LBS</span>
                </div>
              </div>

              {/* Premium Dynamic Machine Tooltip */}
              {item.maintenance && (
                <div className={`absolute bottom-full mb-3.5 w-64 p-3 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 scale-95 group-hover:scale-100 flex flex-col gap-2 font-sans text-left backdrop-blur-md ${item.tooltipAlign}`}>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10px] font-extrabold text-white uppercase tracking-wider">{item.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono uppercase font-bold ${item.maintenance.statusClass}`}>
                      {item.maintenance.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono text-slate-400">
                    <div>
                      <span className="text-slate-500 block uppercase text-[7px] font-bold">Maint. Cycle:</span>
                      <span className="text-amber-500 font-bold">{item.maintenance.schedule}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[7px] font-bold">Last Service:</span>
                      <span className="text-slate-200 font-bold">{item.maintenance.lastService}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[7px] font-bold">Next Service:</span>
                      <span className="text-slate-200 font-bold">{item.maintenance.nextService}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase text-[7px] font-bold">Technician:</span>
                      <span className="text-slate-200 font-bold overflow-hidden text-ellipsis whitespace-nowrap block">{item.maintenance.technician.split(' ')[0]}</span>
                    </div>
                    <div className="col-span-2 mt-1">
                      <span className="text-slate-500 block uppercase text-[7px] font-bold">Assignee Role:</span>
                      <span className="text-indigo-400 font-bold">{item.maintenance.technician}</span>
                    </div>
                    <div className="col-span-2 mt-1 border-t border-slate-800/60 pt-1 text-[8px] text-slate-500 leading-relaxed italic">
                      {item.maintenance.note}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
