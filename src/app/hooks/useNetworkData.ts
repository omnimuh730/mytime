import { useState, useEffect, useCallback } from "react";
import type {
  NetOverviewDto,
  NetConnectionDto,
  NetProcessBandwidthDto,
  NetSpeedSnapshotDto,
} from "../types/backend";
import {
  getNetworkOverview,
  getNetworkConnections,
  getProcessBandwidth,
  getSpeedHistory,
} from "../api/network";

const POLL_MS = 2000;

export function useNetworkOverview() {
  const [overview, setOverview] = useState<NetOverviewDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getNetworkOverview();
      setOverview(data);
    } catch {
      /* keep stale */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { overview, isLoading };
}

export function useNetworkConnections() {
  const [connections, setConnections] = useState<NetConnectionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getNetworkConnections();
      setConnections(data);
    } catch {
      /* keep stale */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { connections, isLoading };
}

export function useProcessBandwidth() {
  const [processes, setProcesses] = useState<NetProcessBandwidthDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getProcessBandwidth();
      setProcesses(data);
    } catch {
      /* keep stale */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { processes, isLoading };
}

export function useSpeedHistory() {
  const [history, setHistory] = useState<NetSpeedSnapshotDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getSpeedHistory();
      setHistory(data);
    } catch {
      /* keep stale */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { history, isLoading };
}
