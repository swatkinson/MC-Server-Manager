import React, { useState } from 'react';
import '../styles/config-panel.css';

interface JVMParametersEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const EXAMPLE_PARAMETERS = [
  { name: 'Heap Size (Max)', value: '-Xmx4G', description: 'Maximum heap memory allocation' },
  { name: 'Heap Size (Min)', value: '-Xms4G', description: 'Initial heap memory allocation' },
  { name: 'GC Type', value: '-XX:+UseG1GC', description: 'Use G1 Garbage Collector' },
  { name: 'GC Parallel Threads', value: '-XX:ParallelGCThreads=4', description: 'Number of GC threads' },
];

export const JVMParametersEditor: React.FC<JVMParametersEditorProps> = ({
  isOpen,
  onClose,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--medium" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">JVM Parameters</h2>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>

        <div className="modal__warning">
          <span className="modal__warning-icon">⚠</span>
          <span>JVM parameter changes require server restart to take effect</span>
        </div>

        <div className="modal__content">
          <div className="jvm-section">
            <h3 className="jvm-section__title">Startup Parameters</h3>
            <p className="jvm-section__description">
              To edit JVM parameters, modify your server startup script or configuration file directly.
              Common locations include:
            </p>
            <ul className="jvm-section__paths">
              <li>start.sh or start.bat</li>
              <li>server.properties</li>
              <li>server configuration files</li>
            </ul>
          </div>

          <div className="jvm-section">
            <button
              className="jvm-section__toggle"
              onClick={() => setExpanded(!expanded)}
            >
              <span className="jvm-section__toggle-icon">{expanded ? '▼' : '▶'}</span>
              Common JVM Parameters
            </button>

            {expanded && (
              <div className="jvm-parameters-list">
                {EXAMPLE_PARAMETERS.map((param, idx) => (
                  <div key={idx} className="jvm-parameter">
                    <div className="jvm-parameter__header">
                      <span className="jvm-parameter__name">{param.name}</span>
                      <code className="jvm-parameter__value">{param.value}</code>
                    </div>
                    <p className="jvm-parameter__description">{param.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="jvm-section">
            <h3 className="jvm-section__title">Example Startup Command</h3>
            <code className="jvm-command-example">
              java -Xmx4G -Xms4G -XX:+UseG1GC -XX:ParallelGCThreads=4 -jar server.jar nogui
            </code>
          </div>

          <div className="jvm-section">
            <h3 className="jvm-section__title">Memory Recommendation</h3>
            <div className="jvm-recommendation">
              <p>
                For a production server, allocate at least 2GB per 20 players, plus extra overhead:
              </p>
              <ul>
                <li>20-30 players: 4GB minimum</li>
                <li>30-50 players: 6-8GB recommended</li>
                <li>50+ players: 10GB+ recommended</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--gray" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
