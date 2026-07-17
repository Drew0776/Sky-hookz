import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Bundle } from '../types';
import { INITIAL_BUNDLES } from '../seedData';
import PageLoader from '../components/PageLoader';
import BundleDetailModal from '../components/BundleDetailModal';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { 
  Wrench, 
  RotateCcw, 
  ArrowRight, 
  Layers, 
  CheckCircle,
  Scissors,
  Flame,
  AlertCircle,
  Zap,
  Sparkles,
  Truck,
  MapPin,
  Package,
  FileDown,
  Search
} from 'lucide-react';

export default function FloorTriggerPage() {
  const { currentRole, currentOperator } = useApp();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Searching/filtering online queues
  const [searchText, setSearchText] = useState('');

  // Modal inspection display
  const [selectedBundleForModal, setSelectedBundleForModal] = useState<Bundle | null>(null);

  // Active production department tab inside workshop floor
  const [activeDept, setActiveDept] = useState<'coating' | 'shearing' | 'bending'>('coating');

  // Input states for routing
  const [selectedShear, setSelectedShear] = useState<Record<string, string>>({});
  const [selectedBender, setSelectedBender] = useState<Record<string, string>>({});
  
  // Interactive CNC Quality Certification Modal Simulation
  const [activeCncSimulationId, setActiveCncSimulationId] = useState<string | null>(null);

  // Batching & Suggestion states
  const [groupingCriteria, setGroupingCriteria] = useState<'route' | 'trailer'>('route');
  const [highlightedGroupKey, setHighlightedGroupKey] = useState<string | null>(null);
  const [batchActionLoading, setBatchActionLoading] = useState<boolean>(false);
  const [batchShearBed, setBatchShearBed] = useState<string>('');
  const [batchBenderMachine, setBatchBenderMachine] = useState<string>('');
  const [excludedBundleIds, setExcludedBundleIds] = useState<Record<string, boolean>>({});

  // Reset excluded selections when state or routing conditions alter
  useEffect(() => {
    setExcludedBundleIds({});
  }, [highlightedGroupKey, groupingCriteria, activeDept]);

  const loadFloorBundles = async () => {
    try {
      const response = await fetch('/api/bundles').catch(() => null);
      if (response && response.ok) {
        setBundles(await response.json());
      } else {
        setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
      }
    } catch (err) {
      console.warn('Network issue loading floor bundles, using local seed fallback:', err);
      setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloorBundles();

    // Setup real-time pub/sub synchronization stream via SSE
    const eventSource = new EventSource('/api/updates');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'update') {
          if (payload.data.bundles) {
            setBundles(payload.data.bundles);
          }
        }
      } catch (err) {
        console.error('Error parsing SSE updates on FloorTriggerPage:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('SSE stream disconnected on FloorTrigger. Re-establishing.');
    };

    // Keep active periodic fail-safe at slow pace
    const interval = setInterval(loadFloorBundles, 25000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, []);

  const clearNotifications = () => {
    setErrorBanner(null);
    setSuccessBanner(null);
  };

  const handleStageCoating = async (bundleId: string) => {
    clearNotifications();
    try {
      const response = await fetch(`/api/bundles/${bundleId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorName: currentOperator?.name || 'Powder Coater',
          location: 'Coat-Station'
        })
      });

      if (response.ok) {
        setSuccessBanner(`Bundle ${bundleId} staged successfully at Coating Line.`);
        loadFloorBundles();
      } else {
        const errData = await response.json();
        setErrorBanner(errData.error || 'Staging failed.');
      }
    } catch (err) {
      setErrorBanner('Network error during staging.');
    }
  };

  const handleSendToShear = async (bundleId: string) => {
    clearNotifications();
    const targetShear = selectedShear[bundleId];
    if (!targetShear) {
      setErrorBanner('Please select a specific shear bed first.');
      return;
    }

    try {
      const response = await fetch(`/api/bundles/${bundleId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorName: currentOperator?.name || 'Shear Operator',
          location: targetShear
        })
      });

      if (response.ok) {
        setSuccessBanner(`Bundle ${bundleId} sheared and staged at ${targetShear}.`);
        loadFloorBundles();
      } else {
        const errData = await response.json();
        setErrorBanner(errData.error || 'Shearing failed.');
      }
    } catch (err) {
      setErrorBanner('Network error during shearing.');
    }
  };

  const handleSendToBender = async (bundleId: string) => {
    clearNotifications();
    const targetBender = selectedBender[bundleId];
    if (!targetBender) {
      setErrorBanner('Please select a specific bender machinery station.');
      return;
    }

    try {
      const response = await fetch(`/api/bundles/${bundleId}/send-to-bender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorName: currentOperator?.name || 'Bending Specialist',
          benderId: targetBender
        })
      });

      if (response.ok) {
        setSuccessBanner(`Bundle ${bundleId} dispatched to ${targetBender} queue.`);
        loadFloorBundles();
      } else {
        const errData = await response.json();
        setErrorBanner(errData.error || 'Fab dispatch failed.');
      }
    } catch (err) {
      setErrorBanner('Network error sending to bender.');
    }
  };

  const handleMarkBent = async (bundleId: string) => {
    clearNotifications();
    try {
      const response = await fetch(`/api/bundles/${bundleId}/mark-bent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorName: currentOperator?.name || 'Bending Specialist'
        })
      });

      if (response.ok) {
        setSuccessBanner(`Fabrication completed for ${bundleId}! Bundle staged for Crane pick-up.`);
        loadFloorBundles();
      } else {
        const errData = await response.json();
        setErrorBanner(errData.error || 'Fabrication completion report failed.');
      }
    } catch (err) {
      setErrorBanner('Network error reporting bent.');
    }
  };

  // Batch action processing handlers
  const handleBatchStageCoating = async (bundleIds: string[]) => {
    clearNotifications();
    setBatchActionLoading(true);
    let successCount = 0;
    let failCount = 0;
    for (const bundleId of bundleIds) {
      try {
        const response = await fetch(`/api/bundles/${bundleId}/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operatorName: currentOperator?.name || 'Powder Coater',
            location: 'Coat-Station'
          })
        });
        if (response.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBatchActionLoading(false);
    setHighlightedGroupKey(null);
    if (successCount > 0) {
      setSuccessBanner(`Batch processed: successfully coated and staged ${successCount} bundles.`);
      loadFloorBundles();
    }
    if (failCount > 0) {
      setErrorBanner(`Failed to process ${failCount} bundles in the batch.`);
    }
  };

  const handleBatchSendToShear = async (bundleIds: string[], targetShearBed: string) => {
    clearNotifications();
    if (!targetShearBed) {
      setErrorBanner('Please select a specific shear bed first for the batch.');
      return;
    }
    setBatchActionLoading(true);
    let successCount = 0;
    let failCount = 0;
    for (const bundleId of bundleIds) {
      try {
        const response = await fetch(`/api/bundles/${bundleId}/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operatorName: currentOperator?.name || 'Shear Operator',
            location: targetShearBed
          })
        });
        if (response.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBatchActionLoading(false);
    setHighlightedGroupKey(null);
    setBatchShearBed('');
    if (successCount > 0) {
      setSuccessBanner(`Batch processed: sheared and staged ${successCount} bundles at ${targetShearBed}.`);
      loadFloorBundles();
    }
    if (failCount > 0) {
      setErrorBanner(`Failed to shear ${failCount} bundles in the batch.`);
    }
  };

  const handleBatchSendToBender = async (bundleIds: string[], targetBenderMachine: string) => {
    clearNotifications();
    if (!targetBenderMachine) {
      setErrorBanner('Please select a specific bender machinery station for the batch.');
      return;
    }
    setBatchActionLoading(true);
    let successCount = 0;
    let failCount = 0;
    for (const bundleId of bundleIds) {
      try {
        const response = await fetch(`/api/bundles/${bundleId}/send-to-bender`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operatorName: currentOperator?.name || 'Bending Specialist',
            benderId: targetBenderMachine
          })
        });
        if (response.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBatchActionLoading(false);
    setHighlightedGroupKey(null);
    setBatchBenderMachine('');
    if (successCount > 0) {
      setSuccessBanner(`Batch processed: routed ${successCount} bundles to ${targetBenderMachine}.`);
      loadFloorBundles();
    }
    if (failCount > 0) {
      setErrorBanner(`Failed to route ${failCount} bundles in the batch.`);
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // Colors setup (RGB)
      const primaryColor = [15, 23, 42]; // Slate 900
      const accentColor = [245, 158, 11]; // Amber 500
      const textColor = [51, 65, 85]; // Slate 700
      const headerTextColor = [255, 255, 255];
      const lightGray = [241, 245, 249]; // Slate 100
      const borderGray = [226, 232, 240]; // Slate 200

      // Add accent indicator bar at top
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(0, 0, 210, 4, 'F');

      let yPos = 15;

      // Header Block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('INDUSTRIAL REBAR MANUFACTURING PROCESS REPORT', 14, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text('Dynamic Real-Time Plant Floor Inventory Summary Log', 14, yPos);
      yPos += 10;

      // Add metadata information
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      const operatorName = currentOperator?.name || currentRole || 'System Operator';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('REPORT GENERATED:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(timestamp, 51, yPos);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('STATION OPERATOR:', 110, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(operatorName, 146, yPos);
      yPos += 8;

      // Horizontal separator line
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.line(14, yPos, 196, yPos);
      yPos += 8;

      // Statistics Section (Summary KPIs)
      const totalWeight = bundles.reduce((sum, b) => sum + (b.weight || 0), 0);
      const totalTons = (totalWeight / 2000).toFixed(2);
      
      const countsByStatus = bundles.reduce<Record<string, { count: number; weight: number }>>((acc, b) => {
        if (!acc[b.status]) acc[b.status] = { count: 0, weight: 0 };
        acc[b.status].count += 1;
        acc[b.status].weight += b.weight || 0;
        return acc;
      }, {});

      // Draw statistics frames side by side (3 boxes)
      const boxW = 56;
      const boxH = 22;
      const startX = 14;

      // Box 1: Total Bundles on Floor
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.roundedRect(startX, yPos, boxW, boxH, 2, 2, 'FD');
      // Content Box 1
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL BUNDLES ON FLOOR', startX + 4, yPos + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(bundles.length.toString(), startX + 4, yPos + 15);

      // Box 2: Total Floor Load (Weight)
      const secX = startX + boxW + 6;
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.roundedRect(secX, yPos, boxW + 6, boxH, 2, 2, 'FD');
      // Content Box 2
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL ACTIVE PAYLOAD', secX + 4, yPos + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]); // Amber
      doc.text(`${totalWeight.toLocaleString()} lbs`, secX + 4, yPos + 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(`(~ ${totalTons} short tons)`, secX + 4, yPos + 19);

      // Box 3: Epoxy vs Black Bar status
      const thirdX = secX + boxW + 12;
      const epoxyBundlesCount = bundles.filter(b => b.grade === 'Epoxy').length;
      const blackBundlesCount = bundles.filter(b => b.grade === 'Black').length;

      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.roundedRect(thirdX, yPos, boxW - 2, boxH, 2, 2, 'FD');
      // Content Box 3
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('GRADE SPLIT (EPOXY / BLACK)', thirdX + 4, yPos + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`${epoxyBundlesCount} Ep  /  ${blackBundlesCount} Bl`, thirdX + 4, yPos + 15);

      yPos += boxH + 10;

      // Status breakdown text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('PRODUCTION FLOW DISTRIBUTION SEGMENTATION:', 14, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      const statusDistributionText = Object.entries(countsByStatus)
        .map(([status, val]) => {
          const stats = val as { count: number; weight: number };
          return `${status}: ${stats.count} (${stats.weight.toLocaleString()} lbs)`;
        })
        .join('  |  ');
      
      doc.text(statusDistributionText, 14, yPos);
      yPos += 8;

      // Horizontal delimiter
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.line(14, yPos, 196, yPos);
      yPos += 7;

      // Section Title: Detailed Inventory Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('DETAILED MANUFACTURE FLOOR CARDS & BUNDLES LISTING', 14, yPos);
      yPos += 5;

      // Table Header Row
      const tableHeaders = ['TAG ID', 'GRADE', 'BAR SIZE', 'LENGTH (FT)', 'WEIGHT (LBS)', 'STATUS', 'LOCATION'];
      const colX = [14, 42, 64, 86, 110, 138, 168]; // X Positions of columns

      // Draw Header Background
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(14, yPos, 182, 7, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
      
      for (let i = 0; i < tableHeaders.length; i++) {
        doc.text(tableHeaders[i], colX[i] + 2, yPos + 5);
      }
      yPos += 7;

      // Sort bundles by status then tagId so it looks nicely organized
      const sortedBundles = [...bundles].sort((a, b) => {
        if (a.status !== b.status) return a.status.localeCompare(b.status);
        return a.tagId.localeCompare(b.tagId);
      });

      // Draw Rows
      let isAltRow = false;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      for (const b of sortedBundles) {
        // If row goes near page bottom boundary, insert a new page and redraw a simplified table header!
        if (yPos > 275) {
          doc.addPage();
          
          // top accent bar on next page too
          doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
          doc.rect(0, 0, 210, 4, 'F');
          
          yPos = 15;
          // Continued header title
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text('DETAILED MANUFACTURE FLOOR LISTING (CONTINUED)', 14, yPos);
          yPos += 6;

          // Redraw table header on new page
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(14, yPos, 182, 7, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
          for (let i = 0; i < tableHeaders.length; i++) {
            doc.text(tableHeaders[i], colX[i] + 2, yPos + 5);
          }
          yPos += 7;
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
        }

        // Draw Row background if alternating
        if (isAltRow) {
          doc.setFillColor(248, 250, 252); // extremely light slate 50
          doc.rect(14, yPos, 182, 6.5, 'F');
        }
        
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);

        doc.text(b.tagId, colX[0] + 2, yPos + 4.5);
        doc.text(b.grade, colX[1] + 2, yPos + 4.5);
        doc.text(b.barSize, colX[2] + 2, yPos + 4.5);
        doc.text(b.length.toString(), colX[3] + 2, yPos + 4.5);
        doc.text(`${(b.weight || 0).toLocaleString()}`, colX[4] + 2, yPos + 4.5);
        
        // Status highlighting
        if (b.status === 'BENDING' || b.status === 'STAGED') {
          doc.setFont('helvetica', 'bold');
          if (b.status === 'BENDING') {
            doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]); // Amber
          } else {
            doc.setTextColor(99, 102, 241); // Indigo
          }
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        }
        doc.text(b.status, colX[5] + 2, yPos + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);

        const locationStr = b.location ? b.location.replace('Bender-', '').replace('Shear-', '') : 'RAW STORAGE';
        doc.text(locationStr, colX[6] + 2, yPos + 4.5);

        yPos += 6.5;
        isAltRow = !isAltRow;
      }

      // Add Footer details
      if (yPos > 270) {
        doc.addPage();
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(0, 0, 210, 4, 'F');
        yPos = 15;
      }

      yPos += 5;
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.line(14, yPos, 196, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text('Confidential Process Log Sheet - Steel Manufacturing Operations & Logistics Group. Generated via Operator Dashboard.', 14, yPos);

      // Stamp paginated dynamic page footprint markings
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text(`Page ${i} of ${totalPages}`, 180, 287);
        
        // Add footer branding separator
        doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
        doc.line(14, 282, 196, 282);
        doc.text('INDUSTRIAL LOGISTICS OPERATIONAL REPORT', 14, 285);
      }

      // Save document
      const fileName = `plant_floor_inventory_report_${new Date().toISOString().substring(0, 10)}.pdf`;
      doc.save(fileName);
      setSuccessBanner(`Successfully generated and downloaded PDF report: ${fileName}`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setErrorBanner('Failed to generate PDF summary report.');
    }
  };

  // Filter lists based on states
  const rawEpoxy = bundles.filter(b => b.status === 'RAW' && b.grade === 'Epoxy');
  const shearingQueue = bundles.filter(b => 
    (b.grade === 'Epoxy' && b.status === 'COATED' && b.location === 'Coat-Station') ||
    (b.grade === 'Black' && b.status === 'RAW' && b.location === 'Raw-SW')
  );
  const fabricationStaging = bundles.filter(b => b.status === 'STAGED' && (b.location.startsWith('Shear') || b.location === 'Raw-SW'));
  const activeBendersList = bundles.filter(b => b.status === 'BENDING');

  // Apply search filtering helper
  const filterBySearch = (list: Bundle[]) => {
    if (!searchText.trim()) return list;
    const term = searchText.toLowerCase().trim();
    return list.filter(b => 
      b.tagId.toLowerCase().includes(term) ||
      (b.mark && b.mark.toLowerCase().includes(term)) ||
      (b.jobId && b.jobId.toLowerCase().includes(term))
    );
  };

  const rawEpoxyFiltered = filterBySearch(rawEpoxy);
  const shearingQueueFiltered = filterBySearch(shearingQueue);
  const fabricationStagingFiltered = filterBySearch(fabricationStaging);
  const activeBendersListFiltered = filterBySearch(activeBendersList);

  // Helper to extract final destination Door / Shipping Bay
  const getDoorFromRoute = (b: Bundle): string => {
    if (b.door) return b.door;
    const routeParts = b.route.split(' -> ');
    const lastPart = routeParts[routeParts.length - 1];
    if (lastPart && lastPart.startsWith('Door-')) {
      return lastPart;
    }
    const doorPart = routeParts.find(p => p.startsWith('Door-'));
    return doorPart || 'Unassigned Bay';
  };

  // Helper to resolve trailer size (by bundle property or job lookup fallback)
  const getTrailerSize = (b: Bundle): string => {
    if (b.trailerSize) return b.trailerSize;
    const sameJobBundle = bundles.find(other => other.jobId === b.jobId && other.trailerSize);
    return sameJobBundle?.trailerSize || 'Unassigned Trailer';
  };

  // Resolve current active tab queue
  const activeTabQueue = activeDept === 'coating' 
    ? rawEpoxy 
    : activeDept === 'shearing' 
      ? shearingQueue 
      : fabricationStaging;

  // Compute groupings for active department
  const groupedSuggestions = React.useMemo(() => {
    const groups: Record<string, Bundle[]> = {};
    activeTabQueue.forEach((b) => {
      const key = groupingCriteria === 'route' ? getDoorFromRoute(b) : getTrailerSize(b);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(b);
    });
    return groups;
  }, [activeTabQueue, groupingCriteria, bundles]);

  if (loading) {
    return <PageLoader message="Calling floor machines databases..." />;
  }

  const isBundleHighlighted = (b: Bundle): boolean => {
    if (!highlightedGroupKey) return false;
    const key = groupingCriteria === 'route' ? getDoorFromRoute(b) : getTrailerSize(b);
    return key === highlightedGroupKey && !excludedBundleIds[b.id];
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'RAW':
        return (
          <span className="transition-all duration-300 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider border bg-sky-500/10 text-sky-450 border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/40 select-none">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500"></span>
            </span>
            RAW
          </span>
        );
      case 'COATED':
        return (
          <span className="transition-all duration-300 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider border bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20 hover:border-teal-500/40 select-none">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-500"></span>
            </span>
            COATED
          </span>
        );
      case 'STAGED':
        return (
          <span className="transition-all duration-300 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider border bg-indigo-500/15 text-indigo-455 border-indigo-500/20 hover:bg-indigo-500/25 hover:border-indigo-500/40 select-none animate-pulse">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
            STAGED
          </span>
        );
      case 'BENDING':
        return (
          <span className="transition-all duration-300 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider border bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/40 select-none">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500 animate-pulse"></span>
            </span>
            BENDING
          </span>
        );
      default:
        return (
          <span className="transition-all duration-300 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6" id="floor-trigger-page">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="font-sans text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" />
            <span>Industrial Workshop Floor Triggers</span>
          </h1>
          <p className="text-xxs text-slate-400 font-mono tracking-wider mt-0.5 uppercase">AUTO-POLLING REFRESH STATS • 10s INTERVALS</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800/90 text-slate-200 hover:text-white px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-800 hover:border-slate-700 transition-all cursor-pointer select-none shadow-sm"
            title="Download cold-chain floor inventory report in PDF format"
          >
            <FileDown className="h-3.5 w-3.5 text-amber-500" />
            <span>EXPORT SUMMARY PDF</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xxs font-mono text-slate-500">OPERATOR LEVEL:</span>
            <span className="font-mono text-xs text-amber-500 font-bold bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
              {currentOperator?.name || currentRole}
            </span>
          </div>
        </div>
      </div>

      {/* Warning / Notification blocks */}
      {errorBanner && (
        <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs font-mono mb-4 animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">
            <span className="font-bold">FLOOR CONTROL ALARM:</span> {errorBanner}
          </div>
          <button onClick={clearNotifications} className="text-slate-500 hover:text-white cursor-pointer select-none">✕</button>
        </div>
      )}

      {successBanner && (
        <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-mono mb-4 animate-fadeIn">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <div className="flex-1">
            <span className="font-bold">LINE REPORT:</span> {successBanner}
          </div>
          <button onClick={clearNotifications} className="text-slate-500 hover:text-white cursor-pointer select-none">✕</button>
        </div>
      )}

      {/* Crane-Optimized Transit Batching Assistant */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4" id="crane-batching-optimizer">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-start gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/10 shrink-0">
              <Zap className="h-4 w-4 text-amber-500 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                Crane-Optimized Transit Batching Assistant
                <span className="text-[9px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded-full font-normal capitalize">
                  Smart Suggestion
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 mt-1 font-sans leading-normal">
                Organize rebar bundles with identical trailer configurations or final shipping routes to expedite crane hoisting, reduce rig cycle times, and minimize cross-yard crane movements.
              </p>
            </div>
          </div>

          {/* Grouping Toggle Controls */}
          <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 p-1 rounded-xl border border-slate-850">
            <button
              onClick={() => {
                setGroupingCriteria('route');
                setHighlightedGroupKey(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xxs font-mono font-bold transition-all cursor-pointer ${
                groupingCriteria === 'route'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="h-3 w-3" />
              <span>By Route Door</span>
            </button>
            <button
              onClick={() => {
                setGroupingCriteria('trailer');
                setHighlightedGroupKey(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xxs font-mono font-bold transition-all cursor-pointer ${
                groupingCriteria === 'trailer'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="h-3 w-3" />
              <span>By Trailer Size</span>
            </button>
          </div>
        </div>

        {/* Suggestion Groups Grid */}
        {Object.keys(groupedSuggestions).length === 0 || activeTabQueue.length === 0 ? (
          <div className="text-center py-6 text-slate-500 font-mono text-xxs border border-dashed border-slate-850 rounded-xl bg-slate-950/10">
            No active bundles in the {activeDept === 'coating' ? 'Coating' : activeDept === 'shearing' ? 'Shearing' : 'Bending'} queue to optimize.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {(Object.entries(groupedSuggestions) as Array<[string, Bundle[]]>).map(([groupKey, groupBundles]) => {
                const isSelected = highlightedGroupKey === groupKey;
                const totalWeight = groupBundles.reduce((sum, b) => sum + (b.weight || 0), 0);
                
                return (
                  <div
                    key={groupKey}
                    onClick={() => setHighlightedGroupKey(isSelected ? null : groupKey)}
                    className={`p-3.5 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/30 shadow-lg shadow-amber-500/5'
                        : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900/30 hover:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xxs font-bold text-white flex items-center gap-1">
                          {groupingCriteria === 'route' ? (
                            <MapPin className="h-3 w-3 text-indigo-400" />
                          ) : (
                            <Truck className="h-3 w-3 text-teal-400" />
                          )}
                          {groupKey}
                        </span>
                        <span className="text-[9px] font-mono text-amber-500 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                          {groupBundles.length} {groupBundles.length === 1 ? 'bundle' : 'bundles'}
                        </span>
                      </div>
                      
                      {/* Technical Breakdown summary */}
                      <p className="text-[10px] text-slate-400 mt-2 font-mono">
                        Included: {groupBundles.map(b => b.tagId).join(', ')}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-850/50 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-slate-500">Weight Load:</span>
                      <span className="text-xxs font-mono font-medium text-slate-300">
                        {totalWeight.toLocaleString()} lbs
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dynamic Interactive Batch Panel for Selected Group */}
            <AnimatePresence>
              {(() => {
                const selectedGroupBundles = highlightedGroupKey ? (groupedSuggestions[highlightedGroupKey] as Bundle[] | undefined) : undefined;
                if (!highlightedGroupKey || !selectedGroupBundles) return null;

                const activeBatchBundles = selectedGroupBundles.filter((b) => !excludedBundleIds[b.id]);
                const activeBatchWeight = activeBatchBundles.reduce((sum, b) => sum + (b.weight || 0), 0);

                return (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="bg-slate-950/90 border border-amber-500/20 rounded-xl p-4 md:p-5 flex flex-col gap-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-855 pb-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-amber-500 font-black block flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5 text-amber-500 animate-pulse" /> ACTIVE BATCH ROUTING SUGGESTION
                        </span>
                        <h3 className="text-xs font-mono font-bold text-white leading-none font-sans mt-0.5">
                          Selected Batch for "{highlightedGroupKey}"
                        </h3>
                        <p className="text-xxs text-slate-400 font-sans leading-relaxed">
                          Coalesce matching jobs in a single run to optimize crane transit cycles. Toggle items below to adjust.
                        </p>
                      </div>

                      {/* Live Dynamic Total Batch Weight & Size indicator */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-lg flex flex-col justify-center min-w-[100px]">
                          <span className="text-[8px] font-mono text-slate-500 uppercase">Batch Count</span>
                          <span className="text-xs font-mono font-bold text-amber-400">
                            {activeBatchBundles.length} / {selectedGroupBundles.length}
                          </span>
                        </div>
                        <div className="bg-slate-900 border border-amber-500/20 px-3 py-1.5 rounded-lg flex flex-col justify-center min-w-[130px] shadow-inner shadow-amber-500/5">
                          <span className="text-[8px] font-mono text-slate-500 uppercase">Total Batch Weight</span>
                          <span className="text-xs font-mono font-bold text-amber-500">
                            {activeBatchWeight.toLocaleString()} lbs
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Selector Panel - Allow adding or removing individual bundles */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                          Include / Exclude Bundles from this Batch:
                        </span>
                        {activeBatchBundles.length === 0 && (
                          <span className="text-[9px] font-mono text-rose-450 font-bold bg-rose-500/10 px-2 py-0.5 rounded animate-pulse">
                            🚨 Empty Batch! Please select at least one bundle.
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedGroupBundles.map((b) => {
                          const isIncluded = !excludedBundleIds[b.id];
                          return (
                            <button
                              key={b.id}
                              onClick={() => {
                                setExcludedBundleIds(prev => ({
                                  ...prev,
                                  [b.id]: !prev[b.id]
                                }));
                              }}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xxs font-mono font-bold border transition-all cursor-pointer select-none ${
                                isIncluded
                                  ? 'bg-amber-500/10 border-amber-500 text-amber-300 hover:bg-amber-500/20'
                                  : 'bg-slate-900/60 border-slate-850/80 text-slate-500 hover:bg-slate-900/30 line-through'
                              }`}
                              title={isIncluded ? `Click to remove bundle ${b.tagId} from batch` : `Click to add bundle ${b.tagId} to batch`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${isIncluded ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`} />
                              <span>{b.tagId}</span>
                              <span className="text-[10px] opacity-75 font-normal">({(b.weight || 0).toLocaleString()} lbs)</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer Actions Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-850/40 pt-4 mt-2">
                      <div className="text-[10px] text-slate-400 leading-normal">
                        {activeBatchBundles.length > 0 ? (
                          <span className="text-slate-300">
                            Ready to dispatch <strong className="text-white font-mono">{activeBatchBundles.length} bundles</strong> containing <strong className="text-white font-mono">{activeBatchBundles.map(b => b.tagId).join(', ')}</strong>.
                          </span>
                        ) : (
                          <span className="text-rose-400 font-semibold">Select bundles above to configure transit payload.</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0 self-end sm:self-auto">
                        {/* Batch Actions tailored to activeDept */}
                        {activeDept === 'coating' && (
                          <button
                            onClick={() => handleBatchStageCoating(activeBatchBundles.map(b => b.id))}
                            disabled={batchActionLoading || activeBatchBundles.length === 0}
                            className="bg-amber-500 text-slate-950 px-4 py-2 text-xxs font-mono font-bold rounded-lg hover:bg-amber-400 transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shadow-md shadow-amber-500/10"
                          >
                            {batchActionLoading ? 'PROCESSING BATCH...' : 'COAT & STAGE BATCH'}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {activeDept === 'shearing' && (
                          <div className="flex items-center gap-2">
                            <select
                              value={batchShearBed}
                              onChange={(e) => setBatchShearBed(e.target.value)}
                              className="bg-slate-900 text-slate-350 border border-slate-800 rounded-lg px-3 py-1.8 text-xxs font-mono focus:border-amber-500"
                            >
                              <option value="">-- Choose Shear Bed --</option>
                              <option value="Shear-North">Shear Bed - North</option>
                              <option value="Shear-Center">Shear Bed - Center</option>
                              <option value="Shear-South">Shear Bed - South</option>
                            </select>
                            <button
                              onClick={() => handleBatchSendToShear(activeBatchBundles.map(b => b.id), batchShearBed)}
                              disabled={batchActionLoading || !batchShearBed || activeBatchBundles.length === 0}
                              className="bg-amber-500 text-slate-950 px-4 py-2 text-xxs font-mono font-bold rounded-lg hover:bg-amber-400 transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-amber-500/10"
                            >
                              {batchActionLoading ? 'SHEARING BATCH...' : 'SHEAR BATCH'}
                            </button>
                          </div>
                        )}

                        {activeDept === 'bending' && (
                          <div className="flex items-center gap-2">
                            <select
                              value={batchBenderMachine}
                              onChange={(e) => setBatchBenderMachine(e.target.value)}
                              className="bg-slate-900 text-slate-350 border border-slate-800 rounded-lg px-3 py-1.8 text-xxs font-mono focus:border-amber-500"
                            >
                              <option value="">-- Select Bender Machine --</option>
                              <option value="Bender-New-Robo">Bender - New-Robo CNC</option>
                              <option value="Bender-Old-Robo">Bender - Old-Robo</option>
                              <option value="Bender-11-Bender">Bender - 11-Bender (HD)</option>
                              <option value="Bender-SE-Bender">Bender - SE-Bender</option>
                              <option value="Bender-Radius-Bender">Bender - Radius-Bender</option>
                            </select>
                            <button
                              onClick={() => handleBatchSendToBender(activeBatchBundles.map(b => b.id), batchBenderMachine)}
                              disabled={batchActionLoading || !batchBenderMachine || activeBatchBundles.length === 0}
                              className="bg-amber-500 text-slate-950 px-4 py-2 text-xxs font-mono font-bold rounded-lg hover:bg-amber-400 transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-amber-500/10"
                            >
                              {batchActionLoading ? 'DISPATCHING BATCH...' : 'ROUTE BATCH'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Search Input Bar row */}
      <div className="mb-4 bg-slate-900/30 p-4 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold flex items-center gap-1.5" htmlFor="floor-queue-search">
            <Search className="h-3.5 w-3.5 text-amber-500" />
            Fab Queue Search Engine
          </label>
          <p className="text-[9px] font-mono text-slate-500">
            Instantly filter Coating, Shearing, and bending fabrication queues by tag reference, mark, or job ID.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <input
            id="floor-queue-search"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search Active Tag ID, Mark, Job ID..."
            className="w-full text-xs font-mono bg-slate-950 border border-slate-850 text-slate-200 placeholder-slate-650 rounded-lg pl-9 pr-8 py-2 focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500/20"
          />
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-white font-mono text-sm leading-none"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Floor Department Navigation Tabs */}
      <div className="flex rounded-xl bg-slate-900/50 p-1 border border-slate-800" role="tablist">
        {[
          { id: 'coating', label: 'Powder Coat Line', icon: Layers, count: rawEpoxyFiltered.length },
          { id: 'shearing', label: 'Shearing Station Beds', icon: Scissors, count: shearingQueueFiltered.length },
          { id: 'bending', label: 'Bender Fabrication', icon: Flame, count: fabricationStagingFiltered.length + activeBendersListFiltered.length }
        ].map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeDept === tab.id}
              onClick={() => {
                setActiveDept(tab.id as any);
                clearNotifications();
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-mono tracking-wider font-bold transition-all cursor-pointer ${
                activeDept === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
              }`}
            >
              <TabIcon className="h-4 w-4" />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-xxs font-mono ${
                activeDept === tab.id ? 'bg-slate-950 text-amber-400' : 'bg-slate-950 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      
      {/* 1. Powder Coating */}
      {activeDept === 'coating' && (
        <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6" id="coating-line-panel">
          <div className="mb-4">
            <h2 className="text-xs font-bold font-mono text-white uppercase tracking-widest mb-1">Staging for Electrostatic Powder Coating</h2>
            <p className="text-xxs text-slate-500 leading-normal font-sans">
              All raw epoxy-coated rebar must process through the coating station before transfer to cut shears. Black rebar bypasses coating.
            </p>
          </div>

          {rawEpoxyFiltered.length === 0 ? (
            <div className="text-center p-12 text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
              No raw epoxy bundles found in current inventory.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rawEpoxyFiltered.map((bundle) => {
                const highlighted = isBundleHighlighted(bundle);
                return (
                  <div 
                    key={bundle.id} 
                    className={`p-4 border rounded-xl flex items-center justify-between hover:border-slate-800 transition-all ${
                      highlighted 
                        ? 'bg-amber-500/5 border-amber-500 ring-1 ring-amber-500/20 shadow-md shadow-amber-500/5 animate-pulse' 
                        : 'bg-slate-900/40 border-slate-850 hover:border-slate-850'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span 
                          onClick={() => setSelectedBundleForModal(bundle)}
                          className="font-mono text-xs font-bold text-teal-400 cursor-pointer hover:underline hover:text-teal-300 transition-colors duration-200"
                          title="Click to audit comprehensive technical specifications and 3D bend geometry"
                        >
                          {bundle.tagId} ({bundle.grade})
                        </span>
                        {renderStatusBadge(bundle.status)}
                        {highlighted && (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-mono tracking-wider font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase animate-pulse transition-all duration-300">
                            <Zap className="h-2 w-2" /> MATCH
                          </span>
                        )}
                      </div>
                      <div className="text-xxs font-mono text-slate-400 mt-1">Bar size {bundle.barSize} • {bundle.length}ft • {bundle.weight}lbs</div>
                      <div className="text-xxs font-mono text-slate-500 mt-0.5 truncate max-w-[280px]">ROUTE: {bundle.route}</div>
                    </div>
                    <button
                      onClick={() => handleStageCoating(bundle.id)}
                      className="inline-flex items-center gap-1 bg-amber-500 px-3.5 py-1.8 text-xxs font-mono font-bold text-slate-950 hover:bg-amber-400 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <span>COAT & STAGE</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Shearing Beds */}
      {activeDept === 'shearing' && (
        <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6" id="shearing-beds-panel">
          <div className="mb-4">
            <h2 className="text-xs font-bold font-mono text-white uppercase tracking-widest mb-1">Shearing Station Beds (Cutting)</h2>
            <p className="text-xxs text-slate-500 leading-normal font-sans">
              Cut bundles to design lengths. Shearing stations sit in the core dividing line between NW (Epoxy) and SW (Black) storage areas.
            </p>
          </div>

          {shearingQueueFiltered.length === 0 ? (
            <div className="text-center p-12 text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
              No bundles buffered in sizing staging buffer.
            </div>
          ) : (
            <div className="space-y-3">
              {shearingQueueFiltered.map((bundle) => {
                const highlighted = isBundleHighlighted(bundle);
                return (
                  <div 
                    key={bundle.id} 
                    className={`p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      highlighted
                        ? 'bg-amber-500/5 border-amber-500 ring-1 ring-amber-500/20 shadow-md shadow-amber-500/5 animate-pulse'
                        : 'bg-slate-900/20 border-slate-850/60 hover:border-slate-800'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span 
                          onClick={() => setSelectedBundleForModal(bundle)}
                          className="font-mono text-xs font-bold text-white cursor-pointer hover:underline hover:text-amber-400 transition-colors duration-200"
                          title="Click to audit comprehensive technical specifications and 3D bend geometry"
                        >
                          {bundle.tagId}
                        </span>
                        <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded transition-all duration-300 ${
                          bundle.grade === 'Epoxy' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}>
                          {bundle.grade}
                        </span>
                        {renderStatusBadge(bundle.status)}
                        {highlighted && (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-mono tracking-wider font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase animate-pulse transition-all duration-300">
                            <Zap className="h-2 w-2" /> MATCH
                          </span>
                        )}
                      </div>
                      <p className="text-xxs font-mono text-slate-400">
                        Length requested: <span className="text-white font-bold">{bundle.length} ft</span> • {bundle.weight} lbs • Size: {bundle.barSize}
                      </p>
                      <p className="text-[10px] font-mono text-slate-550 italic">Location: {bundle.location}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedShear[bundle.id] || ''}
                        onChange={(e) => setSelectedShear({ ...selectedShear, [bundle.id]: e.target.value })}
                        className="bg-slate-950 text-slate-300 border border-slate-800 rounded-lg px-3 py-1.8 text-xxs font-mono focus:border-amber-500"
                      >
                        <option value="">-- Choose Shear Bed --</option>
                        <option value="Shear-North">Shear Bed - North</option>
                        <option value="Shear-Center">Shear Bed - Center</option>
                        <option value="Shear-South">Shear Bed - South</option>
                      </select>

                      <button
                        onClick={() => handleSendToShear(bundle.id)}
                        className="bg-amber-500 text-slate-950 px-3.5 py-1.8 text-xxs font-mono font-bold rounded-lg hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        SHEAR BAR
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Bender Fabrication */}
      {activeDept === 'bending' && (
        <div className="space-y-6" id="bending-stations-panel">
          
          {/* Dispatch section */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6">
            <div className="mb-4">
              <h2 className="text-xs font-bold font-mono text-white uppercase tracking-widest mb-1">Ready for Bender Routing</h2>
              <p className="text-xxs text-slate-500 leading-normal font-sans">
                Assign sized, sheared steel packs to bending machines for precise shape bending fabrication.
              </p>
            </div>

            {fabricationStagingFiltered.length === 0 ? (
              <div className="text-center p-8 text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                No sheaves ready at sheared buffers.
              </div>
            ) : (
              <div className="space-y-3">
                {fabricationStagingFiltered.map((bundle) => {
                  const highlighted = isBundleHighlighted(bundle);
                  return (
                    <div 
                      key={bundle.id} 
                      className={`p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                        highlighted
                          ? 'bg-amber-500/5 border-amber-500 ring-1 ring-amber-500/20 shadow-md shadow-amber-500/5 animate-pulse'
                          : 'bg-slate-900/20 border-slate-850'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span 
                            onClick={() => setSelectedBundleForModal(bundle)}
                            className="font-mono text-xs font-bold text-white cursor-pointer hover:underline hover:text-amber-400 block transition-colors duration-200"
                            title="Click to audit comprehensive technical specifications and 3D bend geometry"
                          >
                            {bundle.tagId}
                          </span>
                          {renderStatusBadge(bundle.status)}
                          {highlighted && (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-mono tracking-wider font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase animate-pulse transition-all duration-300">
                              <Zap className="h-2 w-2" /> MATCH
                            </span>
                          )}
                        </div>
                        <p className="text-xxs font-mono text-slate-400 mt-1">Design Specs: Size {bundle.barSize} • {bundle.length}ft • Cut complete</p>
                        <p className="text-[10px] font-mono text-slate-500">Currently at Sheared Bed: {bundle.location}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={selectedBender[bundle.id] || ''}
                          onChange={(e) => setSelectedBender({ ...selectedBender, [bundle.id]: e.target.value })}
                          className="bg-slate-950 text-slate-300 border border-slate-800 rounded-lg px-3 py-1.8 text-xxs font-mono focus:border-amber-500"
                        >
                          <option value="">-- Select Bender Machine --</option>
                          <option value="Bender-New-Robo">Bender - New-Robo CNC</option>
                          <option value="Bender-Old-Robo">Bender - Old-Robo</option>
                          <option value="Bender-11-Bender">Bender - 11-Bender (HD)</option>
                          <option value="Bender-SE-Bender">Bender - SE-Bender</option>
                          <option value="Bender-Radius-Bender">Bender - Radius-Bender</option>
                        </select>

                        <button
                          onClick={() => handleSendToBender(bundle.id)}
                          className="bg-amber-500 text-slate-950 px-3.5 py-1.8 text-xxs font-mono font-bold rounded-lg hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          ROUTE BENDER
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active bending machinery tracks */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6">
            <div className="mb-4">
              <h2 className="text-xs font-bold font-mono text-white uppercase tracking-widest mb-1">Active Fabrication Mandrels (CNC / Bender Queues)</h2>
              <p className="text-xxs text-slate-500 leading-normal font-sans">
                Monitor machine spindles. Bender operators must click "Mark Bent" once fabrication finishes to stage for crane transfer.
              </p>
            </div>

            {activeBendersListFiltered.length === 0 ? (
              <div className="text-center p-8 text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                All bending machine queues are empty.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeBendersListFiltered.map((bundle) => (
                  <div key={bundle.id} className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl flex items-center justify-between relative overflow-hidden transition-all duration-300 hover:bg-slate-900/60 hover:border-slate-700">
                    <div className="absolute top-0 right-0 h-1.5 w-16 bg-amber-500 animate-pulse"></div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span 
                          onClick={() => setSelectedBundleForModal(bundle)}
                          className="font-mono text-xs font-bold text-white cursor-pointer hover:underline hover:text-amber-400 transition-colors duration-200"
                          title="Click to audit comprehensive technical specifications and 3D bend geometry"
                        >
                          {bundle.tagId}
                        </span>
                        <span className="font-mono text-[9px] uppercase text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 transition-all duration-300 hover:bg-amber-500/20">
                          {bundle.location.replace('Bender-', '')}
                        </span>
                        {renderStatusBadge(bundle.status)}
                      </div>
                      <p className="text-xxs font-mono text-slate-400 mt-2">Tag Mark: {bundle.mark} • Grade: {bundle.grade}</p>
                      <p className="text-xxs font-mono text-slate-500">Route target rack: {bundle.route.split(' -> ').slice(-2, -1)[0] || 'Unknown'}</p>
                    </div>
                    
                    <button
                      onClick={() => setActiveCncSimulationId(bundle.id)}
                      className="bg-slate-950 border border-slate-800 hover:border-amber-500 hover:text-amber-400 text-slate-300 px-3 py-1.5 text-xxs font-mono rounded-lg transition-colors cursor-pointer"
                    >
                      MARK BENT
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {activeCncSimulationId && bundles.find(b => b.id === activeCncSimulationId) && (
        <CncSimulationModal 
          bundle={bundles.find(b => b.id === activeCncSimulationId)!} 
          onClose={() => setActiveCncSimulationId(null)} 
          onComplete={(bundleId) => {
            handleMarkBent(bundleId);
            setActiveCncSimulationId(null);
          }}
        />
      )}

      {selectedBundleForModal && (
        <BundleDetailModal 
          bundle={selectedBundleForModal} 
          onClose={() => setSelectedBundleForModal(null)} 
        />
      )}
    </div>
  );
}

interface CncSimulationModalProps {
  bundle: Bundle;
  onClose: () => void;
  onComplete: (bundleId: string) => void;
}

function CncSimulationModal({ bundle, onClose, onComplete }: CncSimulationModalProps) {
  const [progress, setProgress] = useState(0);
  const [angle, setAngle] = useState(0);
  const [coatingTested, setCoatingTested] = useState(false);
  const [pinsMatched, setPinsMatched] = useState(false);
  const [lengthVerified, setLengthVerified] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const step = Math.floor(Math.random() * 15) + 10;
        const next = Math.min(100, prev + step);
        // Map progress to mandrel degree angles (e.g. 0 to 180 degrees)
        setAngle(Math.round((next / 100) * 180));
        return next;
      });
    }, 350);

    return () => clearInterval(interval);
  }, []);

  const isQcPassed = progress === 100 && coatingTested && pinsMatched && lengthVerified;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="cnc-simulation-modal">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Subtle grid accent */}
        <div className="absolute top-0 right-0 h-1.5 w-full bg-gradient-to-r from-amber-500 to-amber-600"></div>

        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
            <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
              CNC FABRICATION SEQUENCE
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white font-mono text-xs cursor-pointer select-none"
          >
            ✕ CANCEL
          </button>
        </div>

        {/* S6. Machine Mandrel Rotation Display and Stats */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-850/60 font-mono text-xxs space-y-2">
            <span className="text-slate-500 block uppercase text-[8px] font-black">CNC Spindle Telemetry</span>
            <div className="flex justify-between">
              <span className="text-slate-400">Target Material:</span>
              <span className="font-bold text-white">{bundle.tagId} ({bundle.grade})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mandrel Bending Arc:</span>
              <span className="font-bold text-amber-500">{angle}° / 180° BENT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Target Machine Station:</span>
              <span className="font-bold text-slate-300 uppercase">{bundle.location}</span>
            </div>
          </div>

          {/* Animated circular loader */}
          <div className="flex flex-col items-center justify-center p-3 relative space-y-2 select-none">
            <div className="relative h-24 w-24 flex items-center justify-center">
              <svg className="h-full w-full -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  fill="transparent"
                  stroke="#1e293b"
                  strokeWidth="6"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="6"
                  strokeDasharray={`${2.4 * Math.PI * 38 * (progress / 100)} 300`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-sm font-mono font-extrabold text-white">{progress}%</span>
                <span className="text-[7px] text-slate-500 uppercase tracking-widest font-mono">Spindle</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-mono italic">
              {progress < 100 ? '⌛ Rotating Steel Spindle. Stay clear...' : '✅ Bending arc process final.'}
            </span>
          </div>
        </div>

        {/* Quality Certification checklist (Required before completion) */}
        <div className="space-y-3 bg-slate-950/50 p-4 border border-slate-850/80 rounded-xl">
          <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 font-bold block pb-1 border-b border-slate-900">
            Mandatory QA Inspection Checklist
          </span>

          <div className="space-y-2.5 font-mono text-xxs pt-1">
            <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={coatingTested}
                onChange={(e) => setCoatingTested(e.target.checked)}
                className="bg-slate-900 border-slate-800 text-amber-500 focus:ring-amber-500 rounded cursor-pointer"
              />
              <span>{bundle.grade === 'Epoxy' ? 'Epoxy Film Micron Check (min 12 mils thickness)' : 'Steel Surface Integrity Check (No scale or deep pitting)'}</span>
            </label>

            <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={pinsMatched}
                onChange={(e) => setPinsMatched(e.target.checked)}
                className="bg-slate-900 border-slate-800 text-amber-500 focus:ring-amber-500 rounded cursor-pointer"
              />
              <span>Radius Pin Alignment & Mandrel degree matched</span>
            </label>

            <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={lengthVerified}
                onChange={(e) => setLengthVerified(e.target.checked)}
                className="bg-slate-900 border-slate-800 text-amber-500 focus:ring-amber-500 rounded cursor-pointer"
              />
              <span>Tolerance length verified within 1/4 inch margins</span>
            </label>
          </div>
        </div>

        {/* Confirmation Button */}
        <button
          onClick={() => onComplete(bundle.id)}
          disabled={!isQcPassed}
          className={`w-full py-2.5 rounded-xl font-mono text-xs font-bold transition-all border text-center ${
            isQcPassed 
              ? 'bg-emerald-500 text-slate-950 border-emerald-500 hover:bg-emerald-450 cursor-pointer shadow-lg shadow-emerald-500/10'
              : 'bg-slate-950 text-slate-600 border-slate-900 cursor-not-allowed text-slate-650'
          }`}
        >
          {progress < 100 
            ? 'FABRICATING...' 
            : (isQcPassed ? 'APPROVE & MARK COMPLETED' : 'AWAITING LOGS CHECKPOINT')}
        </button>
      </div>
    </div>
  );
}
