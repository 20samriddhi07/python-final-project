import React, { useState, useEffect } from 'react';
import { PageTab } from './types';
import { api } from './services/api';
import { MainLayout } from './layouts/MainLayout';

import { OverviewPage } from './pages/OverviewPage';
import { TrafficAnalysisPage } from './pages/TrafficAnalysisPage';
import { IntrusionDetectionPage } from './pages/IntrusionDetectionPage';
import { ModelTrainingPage } from './pages/ModelTrainingPage';
import { AttackSimulatorPage } from './pages/AttackSimulatorPage';
import { RobustnessEvaluationPage } from './pages/RobustnessEvaluationPage';
import { DefenceMechanismsPage } from './pages/DefenceMechanismsPage';
import { ModelComparisonPage } from './pages/ModelComparisonPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ModuleGroup } from './components/ModuleGroup';

export function App() {
  const [activeTab, setActiveTab] = useState<PageTab>('dashboard');
  const [backendConnected, setBackendConnected] = useState<boolean>(true);
  const [datasetName, setDatasetName] = useState<string | null>(null);
  const [datasetRecords, setDatasetRecords] = useState<number>(0);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      await api.getHealth();
      setBackendConnected(true);
      const overview = await api.getOverview();
      if (overview.active_dataset) {
        setDatasetName(overview.active_dataset);
        setDatasetRecords(overview.total_records_analyzed);
      }
    } catch (e) {
      setBackendConnected(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <OverviewPage onNavigate={setActiveTab} />;
      case 'dataset-training':
        return (
          <ModuleGroup
            tabs={[
              { id: 'dataset', label: 'Dataset', content: <TrafficAnalysisPage /> },
              { id: 'training', label: 'Model Training', content: <ModelTrainingPage /> },
            ]}
          />
        );
      case 'intrusion-detection':
        return <IntrusionDetectionPage />;
      case 'adversarial-testing':
        return (
          <ModuleGroup
            tabs={[
              { id: 'attacks', label: 'Attack Simulator', content: <AttackSimulatorPage /> },
              { id: 'robustness', label: 'Robustness Evaluation', content: <RobustnessEvaluationPage /> },
            ]}
          />
        );
      case 'results-defence':
        return (
          <ModuleGroup
            tabs={[
              { id: 'comparison', label: 'Model Comparison', content: <ModelComparisonPage /> },
              { id: 'defence', label: 'Defence', content: <DefenceMechanismsPage /> },
              { id: 'reports', label: 'Reports', content: <ReportsPage /> },
              { id: 'settings', label: 'Settings', content: <SettingsPage /> },
            ]}
          />
        );
      default:
        return <OverviewPage onNavigate={setActiveTab} />;
    }
  };

  return (
    <MainLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      backendConnected={backendConnected}
      datasetName={datasetName}
      datasetRecords={datasetRecords}
    >
      {renderContent()}
    </MainLayout>
  );
}

export default App;
