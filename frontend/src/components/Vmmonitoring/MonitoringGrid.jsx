import React, { useState, useEffect } from 'react';
import { 
  Server, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Info,
  Clock,
  Cpu,
  MemoryStick,
  HardDrive,
  Calendar,
  MapPin,
  User,
  FileText,
  X,
  Sun,
  Moon,
  Search,
  RefreshCw,
  Filter,
  FolderOpen
} from 'lucide-react';
import { fetchVMMasterData } from '../../services/api';
import styles from '../../styles/MonitoringGrid.module.css';

const MonitoringGrid = ({ dashboardData, vmStatusData, onRefresh }) => {
  const { vms, loading } = dashboardData;
  const { allStatusData } = vmStatusData;
  
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [gridData, setGridData] = useState({});
  const [selectedModal, setSelectedModal] = useState(null);
  const [timeMode, setTimeMode] = useState('AM');
  const [stats, setStats] = useState({ total: 0, reachable: 0, unreachable: 0 });
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [availableProjects, setAvailableProjects] = useState([]);
  const [vmMasterData, setVmMasterData] = useState([]);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Generate hours for AM/PM
  const getHoursForMode = (mode) => {
    if (mode === 'AM') {
      return Array.from({ length: 12 }, (_, i) => {
        const hour = i === 0 ? 12 : i;
        return `${hour}:00 AM`;
      });
    } else {
      return Array.from({ length: 12 }, (_, i) => {
        const hour = i === 0 ? 12 : i;
        return `${hour}:00 PM`;
      });
    }
  };

  const hours = getHoursForMode(timeMode);

  // Scroll event listener for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.pageYOffset > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    if (allStatusData.length > 0) {
      const dates = [...new Set(allStatusData.map(item => new Date(item.current_time).toDateString()))];
      const sortedDates = dates.sort((a, b) => new Date(b) - new Date(a));
      setAvailableDates(sortedDates);
      
      // Get unique projects
      const projects = [...new Set(allStatusData.map(item => item.project).filter(p => p && p !== 'N/A'))];
      setAvailableProjects(projects.sort());
      
      if (!selectedDate && sortedDates.length > 0) {
        setSelectedDate(sortedDates[0]);
      }
    }
  }, [allStatusData, selectedDate]);

  useEffect(() => {
    if (selectedDate && allStatusData.length > 0) {
      processGridData();
      calculateStats();
    }
  }, [selectedDate, allStatusData, timeMode, searchTerm, statusFilter, severityFilter, projectFilter]);

  const processGridData = () => {
    let filtered = allStatusData.filter(item => 
      new Date(item.current_time).toDateString() === selectedDate
    );

    // Apply filters
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vm_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status_change === statusFilter);
    }

    if (projectFilter !== 'all') {
      filtered = filtered.filter(item => item.project === projectFilter);
    }

    const grouped = {};
    
    // Get unique VMs
    const uniqueVMs = [...new Map(filtered.map(item => [item.ip, item])).values()];
    
    uniqueVMs.forEach(vm => {
      const vmKey = `${vm.ip}-${vm.vm_name}`;
      grouped[vmKey] = {
        vm_name: vm.vm_name,
        ip: vm.ip,
        project: vm.project,
        cluster: vm.cluster,
        hourlyData: {}
      };
    });

    // Process hourly data
    filtered.forEach(item => {
      const vmKey = `${item.ip}-${item.vm_name}`;
      const date = new Date(item.current_time);
      const hour = date.getHours();
      const isPM = hour >= 12;
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const hourKey = `${displayHour}:00 ${isPM ? 'PM' : 'AM'}`;
      
      if (grouped[vmKey]) {
        if (!grouped[vmKey].hourlyData[hourKey]) {
          grouped[vmKey].hourlyData[hourKey] = [];
        }
        grouped[vmKey].hourlyData[hourKey].push(item);
      }
    });

    // Apply severity filter
    if (severityFilter !== 'all') {
      const filteredGrouped = {};
      Object.entries(grouped).forEach(([vmKey, vmData]) => {
        const severity = getVMSeverity(vmData);
        if (severity === severityFilter) {
          filteredGrouped[vmKey] = vmData;
        }
      });
      setGridData(filteredGrouped);
    } else {
      setGridData(grouped);
    }
  };

  const calculateStats = () => {
    // Get latest status for each VM
    const latestStatuses = {};
    
    allStatusData.forEach(item => {
      const vmKey = `${item.ip}-${item.vm_name}`;
      const currentTime = new Date(item.current_time);
      
      if (!latestStatuses[vmKey] || new Date(latestStatuses[vmKey].current_time) < currentTime) {
        latestStatuses[vmKey] = item;
      }
    });

    const total = Object.keys(latestStatuses).length;
    const reachable = Object.values(latestStatuses).filter(vm => vm.current_status === 'reachable').length;
    const unreachable = total - reachable;

    setStats({ total, reachable, unreachable });
  };

  const getStatusIcon = (hourData) => {
    if (!hourData || hourData.length === 0) {
      return <div className={styles.emptyCell}></div>;
    }

    // Get the latest status for this hour
    const latestStatus = hourData.sort((a, b) => new Date(b.current_time) - new Date(a.current_time))[0];
    
    const iconProps = {
      className: styles.statusIcon,
      onClick: () => setSelectedModal(latestStatus)
    };

    switch (latestStatus.status_change) {
      case 'came back':
        return <TrendingUp {...iconProps} style={{ color: '#10b981' }} title="Came Back" />;
      case 'went down':
        return <TrendingDown {...iconProps} style={{ color: '#ff6b35' }} title="Went Down" />;
      case 'still down':
        return <XCircle {...iconProps} style={{ color: '#e5512a' }} title="Still Down" />;
      case 'no change':
        return latestStatus.current_status === 'reachable' 
          ? <CheckCircle {...iconProps} style={{ color: '#10b981' }} title="Reachable" />
          : <XCircle {...iconProps} style={{ color: '#ff6b35' }} title="Unreachable" />;
      default:
        return <Info {...iconProps} style={{ color: '#ffd700' }} title="New" />;
    }
  };

  const getVMSeverity = (vmData) => {
    // Find the last reachable time for this VM
    const vmStatuses = allStatusData.filter(item => 
      item.ip === vmData.ip && item.vm_name === vmData.vm_name
    ).sort((a, b) => new Date(b.current_time) - new Date(a.current_time));

    const latestStatus = vmStatuses[0];
    if (!latestStatus || latestStatus.current_status === 'reachable') {
      return 'healthy';
    }

    // Find last reachable time
    const lastReachable = vmStatuses.find(status => status.current_status === 'reachable');
    if (!lastReachable) {
      return 'hazardous'; // Never been reachable
    }

    const daysSinceReachable = (new Date() - new Date(lastReachable.current_time)) / (1000 * 60 * 60 * 24);
    
    if (daysSinceReachable <= 1) return 'warning';
    if (daysSinceReachable <= 3) return 'sensitive';
    return 'hazardous';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'healthy': return '#10b981';
      case 'warning': return '#ffd700';
      case 'sensitive': return '#ff8f65';
      case 'hazardous': return '#e5512a';
      default: return '#64748b';
    }
  };

  const formatDiskUsage = (diskData) => {
    try {
      const disks = typeof diskData === 'string' ? JSON.parse(diskData) : diskData;
      if (!disks || Object.keys(disks).length === 0) return 'N/A';
      
      return Object.entries(disks).map(([drive, usage]) => 
        `${drive}: ${usage}%`
      ).join(', ');
    } catch {
      return 'N/A';
    }
  };

  const getLastReachableTime = (vmData) => {
    const vmStatuses = allStatusData.filter(item => 
      item.ip === vmData.ip && item.vm_name === vmData.vm_name && item.current_status === 'reachable'
    ).sort((a, b) => new Date(b.current_time) - new Date(a.current_time));

    return vmStatuses.length > 0 ? vmStatuses[0].current_time : null;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSeverityFilter('all');
    setProjectFilter('all');
  };

  return (
    <div className={styles.monitoringGrid}>
      {/* Combined Control Panel */}
      <div className={styles.controlPanel}>
        {/* Title and Stats Row */}
        <div className={styles.titleStatsRow}>
          <div className={styles.titleSection}>
            <h2 className={styles.title}>VM Monitoring Grid</h2>
            <p className={styles.subtitle}>Real-time virtual machine status monitoring</p>
          </div>
          
          <div className={styles.statsContainer}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.total}</div>
              <div className={styles.statLabel}>Total VMs</div>
            </div>
            <div className={`${styles.statCard} ${styles.success}`}>
              <CheckCircle className={styles.statIcon} />
              <div className={styles.statValue}>{stats.reachable}</div>
              <div className={styles.statLabel}>Online</div>
            </div>
            <div className={`${styles.statCard} ${styles.error}`}>
              <XCircle className={styles.statIcon} />
              <div className={styles.statValue}>{stats.unreachable}</div>
              <div className={styles.statLabel}>Offline</div>
            </div>
          </div>
        </div>

        {/* Controls and Filters Row */}
        <div className={styles.controlsFiltersRow}>
          <div className={styles.primaryControls}>
            <div className={styles.dateContainer}>
              <Calendar className={styles.controlIcon} />
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={styles.dateSelect}
              >
                {availableDates.map(date => (
                  <option key={date} value={date}>{new Date(date).toLocaleDateString()}</option>
                ))}
              </select>
            </div>

            <div className={styles.timeModeToggle}>
              <button
                className={`${styles.toggleButton} ${timeMode === 'AM' ? styles.active : ''}`}
                onClick={() => setTimeMode('AM')}
              >
                <Sun className={styles.toggleIcon} />
                AM
              </button>
              <button
                className={`${styles.toggleButton} ${timeMode === 'PM' ? styles.active : ''}`}
                onClick={() => setTimeMode('PM')}
              >
                <Moon className={styles.toggleIcon} />
                PM
              </button>
            </div>

            <button 
              onClick={onRefresh} 
              className={styles.refreshButton}
              disabled={loading}
            >
              <RefreshCw className={loading ? styles.spinning : ''} />
              Refresh
            </button>
          </div>

          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search VM name or IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        {/* Filters and Legend Row */}
        <div className={styles.filtersLegendRow}>
          <div className={styles.filterGroup}>
            <div className={styles.filterContainer}>
              <Filter className={styles.filterIcon} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Status</option>
                <option value="no change">No Change</option>
                <option value="came back">Came Back</option>
                <option value="went down">Went Down</option>
                <option value="still down">Still Down</option>
              </select>
            </div>

            <div className={styles.filterContainer}>
              <AlertTriangle className={styles.filterIcon} />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Severity</option>
                <option value="healthy">Healthy</option>
                <option value="warning">Warning</option>
                <option value="sensitive">Sensitive</option>
                <option value="hazardous">Hazardous</option>
              </select>
            </div>

            <div className={styles.filterContainer}>
              <FolderOpen className={styles.filterIcon} />
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Projects</option>
                {availableProjects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </div>

            <button onClick={clearFilters} className={styles.clearButton}>
              Clear Filters
            </button>
          </div>

          <div className={styles.legendContainer}>
            <div className={styles.legend}>
              <div className={styles.legendTitle}>Status Legend:</div>
              <div className={styles.legendItems}>
                <div className={styles.legendItem}>
                  <CheckCircle style={{ color: '#10b981' }} />
                  <span>Reachable</span>
                </div>
                <div className={styles.legendItem}>
                  <XCircle style={{ color: '#ef4444' }} />
                  <span>Unreachable</span>
                </div>
                <div className={styles.legendItem}>
                  <TrendingUp style={{ color: '#10b981' }} />
                  <span>Came Back</span>
                </div>
                <div className={styles.legendItem}>
                  <TrendingDown style={{ color: '#ef4444' }} />
                  <span>Went Down</span>
                </div>
              </div>
            </div>
            
            <div className={styles.severityLegend}>
              <div className={styles.legendTitle}>VM Health:</div>
              <div className={styles.legendItems}>
                <div className={styles.legendItem}>
                  <div className={styles.severityIndicator} style={{ background: '#10b981' }}></div>
                  <span>Healthy</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.severityIndicator} style={{ background: '#f59e0b' }}></div>
                  <span>Warning (&lt;1 day)</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.severityIndicator} style={{ background: '#ef4444' }}></div>
                  <span>Sensitive (1-3 days)</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.severityIndicator} style={{ background: '#7c2d12' }}></div>
                  <span>Hazardous (&gt;3 days)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Grid Table */}
      <div className={styles.gridContainer}>
        <div className={styles.gridTable}>
          {/* Header Row */}
          <div className={styles.gridHeader}>
            <div className={styles.vmNameHeader}>
              <Server className={styles.headerIcon} />
              VM Details
            </div>
            {hours.map(hour => (
              <div key={hour} className={styles.hourHeader}>
                <Clock className={styles.hourIcon} />
                <span className={styles.hourText}>{hour.replace(':00', '')}</span>
              </div>
            ))}
          </div>

          {/* Data Rows */}
          <div className={styles.gridBody}>
            {Object.entries(gridData).map(([vmKey, vmData]) => {
              const severity = getVMSeverity(vmData);
              return (
                <div key={vmKey} className={styles.gridRow}>
                  <div 
                    className={styles.vmNameCell}
                    style={{ borderLeft: `3px solid ${getSeverityColor(severity)}` }}
                  >
                    <div className={styles.vmInfo}>
                      <div className={styles.vmIconContainer}>
                        <Server 
                          className={styles.vmIcon} 
                          style={{ color: getSeverityColor(severity) }}
                        />
                        {vmData.project && vmData.project !== 'N/A' && (
                          <div className={styles.projectTooltip}>
                            <FolderOpen className={styles.projectIcon} />
                            Project: {vmData.project}
                          </div>
                        )}
                      </div>
                      <div className={styles.vmDetails}>
                        <span className={styles.vmName}>{vmData.vm_name}</span>
                        <span className={styles.vmIp}>{vmData.ip}</span>
                      </div>
                    </div>
                  </div>
                  
                  {hours.map(hour => (
                    <div key={hour} className={styles.statusCell}>
                      {getStatusIcon(vmData.hourlyData[hour])}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedModal && (
        <div className={styles.modalOverlay} onClick={() => setSelectedModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>VM Status Details</h3>
              <button 
                onClick={() => setSelectedModal(null)}
                className={styles.closeButton}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalContent}>
              <div className={styles.modalSection}>
                <h4>Basic Information</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <Server className={styles.infoIcon} />
                    <div>
                      <span className={styles.infoLabel}>VM Name</span>
                      <span className={styles.infoValue}>{selectedModal.vm_name}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <MapPin className={styles.infoIcon} />
                    <div>
                      <span className={styles.infoLabel}>IP Address</span>
                      <span className={styles.infoValue}>{selectedModal.ip}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <Info className={styles.infoIcon} />
                    <div>
                      <span className={styles.infoLabel}>Current Status</span>
                      <span className={`${styles.infoValue} ${selectedModal.current_status === 'reachable' ? styles.success : styles.error}`}>
                        {selectedModal.current_status}
                      </span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <Clock className={styles.infoIcon} />
                    <div>
                      <span className={styles.infoLabel}>Check Time</span>
                      <span className={styles.infoValue}>
                        {new Date(selectedModal.current_time).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedModal.project && selectedModal.project !== 'N/A' && (
                <div className={styles.modalSection}>
                  <h4>Project Information</h4>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <FileText className={styles.infoIcon} />
                      <div>
                        <span className={styles.infoLabel}>Project</span>
                        <span className={styles.infoValue}>{selectedModal.project}</span>
                      </div>
                    </div>
                    {selectedModal.cluster && selectedModal.cluster !== 'N/A' && (
                      <div className={styles.infoItem}>
                        <Server className={styles.infoIcon} />
                        <div>
                          <span className={styles.infoLabel}>Cluster</span>
                          <span className={styles.infoValue}>{selectedModal.cluster}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedModal.current_status === 'not reachable' && (
                <div className={styles.modalSection}>
                  <h4>Unreachable Information</h4>
                  <div className={styles.infoGrid}>
                    {getLastReachableTime(selectedModal) && (
                      <div className={styles.infoItem}>
                        <Clock className={styles.infoIcon} />
                        <div>
                          <span className={styles.infoLabel}>Last Reachable</span>
                          <span className={styles.infoValue}>
                            {new Date(getLastReachableTime(selectedModal)).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className={styles.infoItem}>
                      <AlertTriangle className={styles.infoIcon} />
                      <div>
                        <span className={styles.infoLabel}>Severity</span>
                        <span 
                          className={styles.infoValue}
                          style={{ color: getSeverityColor(getVMSeverity(selectedModal)) }}
                        >
                          {getVMSeverity(selectedModal).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Find corresponding VM data for metrics */}
              {(() => {
                const vmMetrics = vms.find(vm => vm.ip === selectedModal.ip);
                return vmMetrics && vmMetrics.status === 'reachable' && (
                  <div className={styles.modalSection}>
                    <h4>System Metrics</h4>
                    <div className={styles.metricsGrid}>
                      <div className={styles.metricCard}>
                        <Cpu className={styles.metricIcon} />
                        <div className={styles.metricContent}>
                          <span className={styles.metricLabel}>CPU Usage</span>
                          <div className={styles.metricBar}>
                            <div 
                              className={styles.metricFill}
                              style={{ width: `${vmMetrics.cpu_utilization}%` }}
                            />
                          </div>
                          <span className={styles.metricValue}>{vmMetrics.cpu_utilization}%</span>
                        </div>
                      </div>

                      <div className={styles.metricCard}>
                        <MemoryStick className={styles.metricIcon} />
                        <div className={styles.metricContent}>
                          <span className={styles.metricLabel}>Memory Usage</span>
                          <div className={styles.metricBar}>
                            <div 
                              className={styles.metricFill}
                              style={{ width: `${vmMetrics.memory_utilization}%` }}
                            />
                          </div>
                          <span className={styles.metricValue}>{vmMetrics.memory_utilization}%</span>
                        </div>
                      </div>

                      <div className={styles.metricCard}>
                        <HardDrive className={styles.metricIcon} />
                        <div className={styles.metricContent}>
                          <span className={styles.metricLabel}>Disk Usage</span>
                          <span className={styles.diskValue}>{formatDiskUsage(vmMetrics.disk_utilization)}</span>
                        </div>
                      </div>

                      <div className={styles.infoItem}>
                        <Info className={styles.infoIcon} />
                        <div>
                          <span className={styles.infoLabel}>Operating System</span>
                          <span className={styles.infoValue}>{vmMetrics.os}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitoringGrid;