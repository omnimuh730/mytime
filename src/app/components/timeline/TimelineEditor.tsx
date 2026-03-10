import { useState, useMemo, useCallback } from "react";
import { TimelineToolbar } from "./TimelineToolbar";
import { TimelineTracks } from "./TimelineTracks";
import { AppUsageList } from "./AppUsageList";
import {
  type APMDataPoint,
  type ActivityStatus,
  type NetworkDataPoint,
  type TimelineMarker,
  type TimelineBlock,
  generateTimelineBlocks,
  generateNetworkData,
  generateAPMData,
  generateMarkers,
  generateActivityStatus,
} from "./timeline-data";

interface TimelineEditorProps {
  blocks?: TimelineBlock[];
  networkData?: NetworkDataPoint[];
  apmData?: APMDataPoint[];
  markers?: TimelineMarker[];
  activityStatus?: ActivityStatus[];
  isLoading?: boolean;
}

export function TimelineEditor({
  blocks: externalBlocks,
  networkData: externalNetworkData,
  apmData: externalApmData,
  markers: externalMarkers,
  activityStatus: externalActivityStatus,
  isLoading = false,
}: TimelineEditorProps) {
  const [blocks, setBlocks] = useState<TimelineBlock[]>(() =>
    externalBlocks ?? generateTimelineBlocks()
  );
  const [zoom, setZoom] = useState(1.5);
  const [visibleTracks, setVisibleTracks] = useState({
    status: true,
    windows: true,
    network: externalNetworkData === undefined ? true : externalNetworkData.length > 0,
    apm: externalApmData === undefined ? true : externalApmData.length > 0,
  });
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(
    new Set()
  );

  const networkData = useMemo(
    () => externalNetworkData ?? generateNetworkData(),
    [externalNetworkData],
  );
  const apmData = useMemo(
    () => externalApmData ?? generateAPMData(),
    [externalApmData],
  );
  const markers = useMemo(
    () => externalMarkers ?? generateMarkers(),
    [externalMarkers],
  );
  const activityStatus = useMemo(
    () => externalActivityStatus ?? generateActivityStatus(),
    [externalActivityStatus],
  );
  const resolvedBlocks = externalBlocks ?? blocks;

  const handleSelectBlock = useCallback(
    (block: TimelineBlock) => {
      setSelectedBlockIds((prev) => {
        const next = new Set(prev);
        if (next.has(block.id)) {
          next.delete(block.id);
        } else {
          next.add(block.id);
        }
        return next;
      });
    },
    []
  );

  const handleToggleTrack = (track: string) => {
    setVisibleTracks((prev) => ({ ...prev, [track]: !prev[track] }));
  };

  return (
    <div className="space-y-3 w-full min-w-0">
      {/* Toolbar */}
      <TimelineToolbar
        zoom={zoom}
        visibleTracks={visibleTracks}
        onToggleTrack={handleToggleTrack}
        selectedCount={selectedBlockIds.size}
        onClearSelection={() => setSelectedBlockIds(new Set())}
      />

      {/* Multi-Track Timeline */}
      <TimelineTracks
        blocks={resolvedBlocks}
        networkData={networkData}
        apmData={apmData}
        markers={markers}
        activityStatus={activityStatus}
        zoom={zoom}
        onZoomChange={setZoom}
        visibleTracks={visibleTracks}
        onSelectBlock={handleSelectBlock}
        selectedBlockIds={selectedBlockIds}
      />

      {/* App Usage Detail List */}
      <AppUsageList
        blocks={resolvedBlocks}
        isLoading={isLoading}
        onBlockSelect={handleSelectBlock}
        selectedBlockIds={selectedBlockIds}
      />
    </div>
  );
}