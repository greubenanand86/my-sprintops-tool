import { EstimationItem } from '../types/estimation';
import { MOCK_READINESS_DATA } from './mockReadinessData';

// Generate initial estimation data based on the readiness mock data
export const MOCK_ESTIMATION_DATA: EstimationItem[] = MOCK_READINESS_DATA.map(item => {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    state: item.state,
    tags: item.tags,
    visibleTabs: item.visibleTabs,
    tasks: {
      Dev: { id: item.tasks.Dev.id, type: 'Dev', original: 8, remaining: 4, completed: 4, isOverridden: false },
      QA: { id: item.tasks.QA.id, type: 'QA', original: 2, remaining: 2, completed: 0, isOverridden: false },
      UAT: { id: item.tasks.UAT.id, type: 'UAT', original: 1.5, remaining: 1.5, completed: 0, isOverridden: false }
    }
  };
});

// Introduce some missing/overridden data for testing filters
if (MOCK_ESTIMATION_DATA[1]) {
  MOCK_ESTIMATION_DATA[1].tasks.Dev.original = '';
  MOCK_ESTIMATION_DATA[1].tasks.QA.original = '';
  MOCK_ESTIMATION_DATA[1].tasks.UAT.original = '';
}

if (MOCK_ESTIMATION_DATA[2]) {
  MOCK_ESTIMATION_DATA[2].tasks.QA.original = 5;
  MOCK_ESTIMATION_DATA[2].tasks.QA.isOverridden = true;
  MOCK_ESTIMATION_DATA[2].tasks.Dev.remaining = '';
}
