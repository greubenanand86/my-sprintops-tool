import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { SessionConfig, AdoField, AdoUser, AdoIteration, ValidationErrors } from '../types/config';
import { validateConfig, calculateCompleteness } from '../utils/validation';
import { fetchWithRetry } from '../utils/api';
import { getApiUrl, safeParseApiResponse } from '../utils/apiUtils';
import { toArray } from '../utils/arrayUtils';

export const INITIAL_CONFIG_DEFAULT: SessionConfig = {
  ado: { orgUrl: 'https://headstreamtech.visualstudio.com/', project: 'Performer', team: 'Performer Team' },
  iteration: { defaultCurrent: true, allowManual: false, selectedPath: '' },
  mapping: { tags: 'System.Tags', originalEstimate: 'Microsoft.VSTS.Scheduling.OriginalEstimate', remaining: 'Microsoft.VSTS.Scheduling.RemainingWork', completed: 'Microsoft.VSTS.Scheduling.CompletedWork', state: 'System.State', iterationPath: 'System.IterationPath', areaPath: 'System.AreaPath' },
  assignee: { devBehavior: 'parent', qaAssignee: null },
  tasks: { childWorkItemType: 'Task', devPattern: 'Dev task for <parent ID> - <parent title>', qaPattern: 'QA task for <parent ID> - <parent title>', uatPattern: 'UAT task for <parent ID> - <parent title>', postPattern: 'Post deployment testing task for <parent ID> - <parent title>', inheritIteration: true, inheritArea: true, defaultState: 'New', emptyDescription: true, inheritTags: false, preventDuplicates: true },
  readiness: { parentState: 'Ready for Production', requiredClosedTasks: ['dev', 'qa', 'uat'], deploymentLinkRequired: true, ignorePostDeployment: true },
  estimation: { estimateTaskTypes: ['dev', 'qa', 'uat'], excludeTaskTypes: ['postDeployment'], qaPercentOfDev: 25, uatPercentOfDev: 15, roundToNearest: 0.5, stopAutoUpdateOnOverride: true },
  grouping: { productTabs: ['Learner Wallet', 'Edlusion', 'NCSI'], fallbackTab: 'General', productionIssueMultiTab: true },
  aiRecommendation: { provider: 'openai', fieldMappings: { additionalContext: [] }, includeAttachments: true }
};

interface ConfigContextType {
  committedConfig: SessionConfig | null;
  draftConfig: SessionConfig;
  updateDraft: <K extends keyof SessionConfig>(section: K, data: SessionConfig[K]) => void;
  commitDraft: () => void;
  resetDraft: () => void;
  updateCommittedConfig: <K extends keyof SessionConfig>(section: K, data: SessionConfig[K]) => void;
  isDirty: boolean;
  isValid: boolean;
  completeness: number;
  errors: ValidationErrors;
  adoFields: AdoField[];
  setAdoFields: (fields: AdoField[]) => void;
  adoUsers: AdoUser[];
  setAdoUsers: (users: AdoUser[]) => void;
  iterations: AdoIteration[];
  setIterations: (iterations: AdoIteration[]) => void;
  connectionStatus: 'idle' | 'testing' | 'success' | 'failure';
  setConnectionStatus: (status: 'idle' | 'testing' | 'success' | 'failure') => void;
  checkConnection: () => Promise<void>;
  openAiKey: string;
  saveOpenAiKey: (key: string) => void;
  geminiKey: string;
  saveGeminiKey: (key: string) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const hydrateConfigWithDefaults = (rawUser: any): SessionConfig => {
  return {
    ...INITIAL_CONFIG_DEFAULT,
    ...rawUser,
    ado: { ...INITIAL_CONFIG_DEFAULT.ado, ...(rawUser?.ado || {}) },
    iteration: { ...INITIAL_CONFIG_DEFAULT.iteration, ...(rawUser?.iteration || {}) },
    mapping: { ...INITIAL_CONFIG_DEFAULT.mapping, ...(rawUser?.mapping || {}) },
    assignee: { ...INITIAL_CONFIG_DEFAULT.assignee, ...(rawUser?.assignee || {}) },
    tasks: { ...INITIAL_CONFIG_DEFAULT.tasks, ...(rawUser?.tasks || {}) },
    aiRecommendation: {
      ...INITIAL_CONFIG_DEFAULT.aiRecommendation,
      ...(rawUser?.aiRecommendation || {}),
      fieldMappings: {
        ...INITIAL_CONFIG_DEFAULT.aiRecommendation?.fieldMappings,
        ...(rawUser?.aiRecommendation?.fieldMappings || {}),
        additionalContext: toArray(rawUser?.aiRecommendation?.fieldMappings?.additionalContext)
      }
    },
    readiness: {
      ...INITIAL_CONFIG_DEFAULT.readiness,
      ...(rawUser?.readiness || {}),
      requiredClosedTasks: toArray(rawUser?.readiness?.requiredClosedTasks || INITIAL_CONFIG_DEFAULT.readiness.requiredClosedTasks)
    },
    estimation: {
      ...INITIAL_CONFIG_DEFAULT.estimation,
      ...(rawUser?.estimation || {}),
      estimateTaskTypes: toArray(rawUser?.estimation?.estimateTaskTypes || INITIAL_CONFIG_DEFAULT.estimation.estimateTaskTypes),
      excludeTaskTypes: toArray(rawUser?.estimation?.excludeTaskTypes || INITIAL_CONFIG_DEFAULT.estimation.excludeTaskTypes)
    },
    grouping: {
      ...INITIAL_CONFIG_DEFAULT.grouping,
      ...(rawUser?.grouping || {}),
      productTabs: toArray(rawUser?.grouping?.productTabs || INITIAL_CONFIG_DEFAULT.grouping.productTabs)
    }
  };
};

const initializeConfig = (): SessionConfig | null => {
  const storedUser = localStorage.getItem('sprintops_user_config');
  if (!storedUser) return null;
  try {
    return hydrateConfigWithDefaults(JSON.parse(storedUser));
  } catch (e) {
    return null;
  }
};

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [committedConfig, setCommittedConfig] = useState<SessionConfig | null>(initializeConfig);
  const [draftConfig, setDraftConfig] = useState<SessionConfig>(() => committedConfig || INITIAL_CONFIG_DEFAULT);
  const [adoFields, setAdoFields] = useState<AdoField[]>([]);
  const [adoUsers, setAdoUsers] = useState<AdoUser[]>([]);
  const [iterations, setIterations] = useState<AdoIteration[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failure'>('idle');

  const [openAiKey, setOpenAiKey] = useState<string>(() => {
    const storedAuth = sessionStorage.getItem('sprintops_session_auth');
    return storedAuth ? JSON.parse(storedAuth).openAiKey || '' : '';
  });
  const [geminiKey, setGeminiKey] = useState<string>(() => {
    const storedAuth = sessionStorage.getItem('sprintops_session_auth');
    return storedAuth ? JSON.parse(storedAuth).geminiKey || '' : '';
  });

  const errors = useMemo(() => validateConfig(draftConfig, adoFields), [draftConfig, adoFields]);
  const completeness = useMemo(() => calculateCompleteness(errors), [errors]);
  const isValid = completeness === 100;

  const isDirty = useMemo(() => {
    const base = committedConfig || INITIAL_CONFIG_DEFAULT;
    return JSON.stringify(draftConfig) !== JSON.stringify(base);
  }, [draftConfig, committedConfig]);

  const checkConnection = useCallback(async () => {
    setConnectionStatus('testing');
    try {
      const res = await fetchWithRetry(getApiUrl('test-connection'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftConfig.ado)
      });
      const parsed = await safeParseApiResponse(res);
      setConnectionStatus(parsed.ok ? 'success' : 'failure');
    } catch (err) {
      setConnectionStatus('failure');
    }
  }, [draftConfig.ado]);

  useEffect(() => {
    if (committedConfig) {
      checkConnection();
    }
  }, [checkConnection, committedConfig]);

  const updateDraft = <K extends keyof SessionConfig>(section: K, data: SessionConfig[K]) => {
    setDraftConfig(prev => {
      const next = { ...prev, [section]: data };
      if (section === 'ado') {
        setConnectionStatus('idle');
      }
      return next;
    });
  };

  const commitDraft = () => {
    if (!isValid) return;
    localStorage.setItem('sprintops_user_config', JSON.stringify(draftConfig));
    setCommittedConfig(draftConfig);
    checkConnection();
  };

  const updateCommittedConfig = useCallback(<K extends keyof SessionConfig>(section: K, data: SessionConfig[K]) => {
    setCommittedConfig(prev => {
      if (!prev) return null;
      const next = { ...prev, [section]: data };
      localStorage.setItem('sprintops_user_config', JSON.stringify(next));
      return next;
    });
  }, []);

  const saveOpenAiKey = (key: string) => {
    setOpenAiKey(key);
    const storedAuth = sessionStorage.getItem('sprintops_session_auth');
    const parsedAuth = storedAuth ? JSON.parse(storedAuth) : {};
    sessionStorage.setItem('sprintops_session_auth', JSON.stringify({ ...parsedAuth, openAiKey: key }));
  };

  const saveGeminiKey = (key: string) => {
    setGeminiKey(key);
    const storedAuth = sessionStorage.getItem('sprintops_session_auth');
    const parsedAuth = storedAuth ? JSON.parse(storedAuth) : {};
    sessionStorage.setItem('sprintops_session_auth', JSON.stringify({ ...parsedAuth, geminiKey: key }));
  };

  const resetDraft = () => {
    localStorage.removeItem('sprintops_user_config');
    sessionStorage.removeItem('sprintops_session_auth');
    setCommittedConfig(null);
    setDraftConfig(INITIAL_CONFIG_DEFAULT);
    setConnectionStatus('idle');
    setAdoFields([]);
    setAdoUsers([]);
    setIterations([]);
    setOpenAiKey('');
    setGeminiKey('');
  };

  return (
    <ConfigContext.Provider value={{
      committedConfig, draftConfig, updateDraft, commitDraft, resetDraft, updateCommittedConfig,
      isDirty, isValid, completeness, errors,
      adoFields, setAdoFields, adoUsers, setAdoUsers, iterations, setIterations,
      connectionStatus, setConnectionStatus, checkConnection,
      openAiKey, saveOpenAiKey, geminiKey, saveGeminiKey
    }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within ConfigProvider');
  return context;
};
