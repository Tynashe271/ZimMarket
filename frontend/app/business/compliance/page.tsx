'use client';

import { useState, useEffect } from 'react';
import { FileText, Upload, CheckCircle, AlertTriangle, Clock, ShieldCheck, X, Download, Plus, ChevronRight, AlertCircle } from 'lucide-react';

type ComplianceStatus = 'DRAFT' | 'PENDING_VERIFICATION' | 'CHANGES_REQUIRED' | 'COMPLIANT' | 'EXPIRING_SOON' | 'EXPIRED' | 'DEVICE_INACTIVE' | 'SUSPENDED' | 'UNDER_REVIEW';

type FiscalisationMethod = 'PHYSICAL_DEVICE' | 'FISCALISED_POS' | 'VIRTUAL_DEVICE' | 'FDMS_API';

interface ComplianceData {
  id: string;
  registeredBusinessName: string;
  tradingName: string;
  tin: string;
  vatNumber?: string;
  taxClearanceCertificateNumber: string;
  taxClearanceIssuedAt: string;
  taxClearanceExpiresAt: string;
  taxClearanceDocumentKey: string;
  method: FiscalisationMethod;
  deviceIdentifier: string;
  deviceModel?: string;
  deviceSerialNumber?: string;
  virtualDeviceIdentifier?: string;
  approvedSupplierOrIntegrator: string;
  zimraRegistrationEvidenceKey: string;
  branchInformation: Record<string, unknown>;
  sampleFiscalReceiptKey: string;
  receiptVerificationCode: string;
  authorisedRepresentative: string;
  status: ComplianceStatus;
  taxpayerActive: boolean;
  deviceActive: boolean;
  deviceRegistered: boolean;
  receiptVerifiedAt?: string;
  nextReviewAt?: string;
}

interface Document {
  id: string;
  documentType: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  verificationStatus: string;
}

interface Restriction {
  type: string;
  isRestricted: boolean;
  reason: string;
  imposedAt: string;
  liftedAt?: string;
}

export default function BusinessCompliancePage() {
  const [session, setSession] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string>('');
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'submit' | 'documents' | 'restrictions'>('overview');

  useEffect(() => {
    const savedSession = localStorage.getItem('zimmarket.session');
    if (savedSession) {
      const sessionData = JSON.parse(savedSession);
      setSession(sessionData);
      loadComplianceData(sessionData);
    }
  }, []);

  const loadComplianceData = async (sessionData: any) => {
    try {
      setLoading(true);
      const businessesResponse = await fetch('/api/businesses', {
        headers: { Authorization: `Bearer ${sessionData.accessToken}` }
      });
      const businesses = await businessesResponse.json();
      
      if (businesses.length > 0) {
        const business = businesses[0];
        setBusinessId(business.id);
        
        // Get compliance status
        const complianceResponse = await fetch(`/api/businesses/${business.id}/compliance`, {
          headers: { Authorization: `Bearer ${sessionData.accessToken}` }
        });
        const complianceData = await complianceResponse.json();
        
        if (complianceData.hasSubmission) {
          setCompliance(complianceData.fiscalisation);
          setDocuments(complianceData.documents || []);
          setRestrictions(complianceData.restrictions || []);
        }
      }
    } catch (err) {
      setError('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const complianceData = {
        registeredBusinessName: formData.get('registeredBusinessName') as string,
        tradingName: formData.get('tradingName') as string,
        tin: formData.get('tin') as string,
        vatNumber: formData.get('vatNumber') as string || undefined,
        taxClearanceCertificateNumber: formData.get('taxClearanceCertificateNumber') as string,
        taxClearanceIssuedAt: formData.get('taxClearanceIssuedAt') as string,
        taxClearanceExpiresAt: formData.get('taxClearanceExpiresAt') as string,
        taxClearanceDocumentKey: `temp-${Date.now()}`, // In production, this would be from actual file upload
        method: formData.get('method') as FiscalisationMethod,
        deviceIdentifier: formData.get('deviceIdentifier') as string,
        deviceModel: formData.get('deviceModel') as string || undefined,
        deviceSerialNumber: formData.get('deviceSerialNumber') as string || undefined,
        virtualDeviceIdentifier: formData.get('virtualDeviceIdentifier') as string || undefined,
        approvedSupplierOrIntegrator: formData.get('approvedSupplierOrIntegrator') as string,
        zimraRegistrationEvidenceKey: `temp-${Date.now()}`,
        branchInformation: {
          branches: [{ name: 'Main Branch', city: 'Harare', province: 'Harare' }]
        },
        sampleFiscalReceiptKey: `temp-${Date.now()}`,
        receiptVerificationCode: formData.get('receiptVerificationCode') as string,
        authorisedRepresentative: formData.get('authorisedRepresentative') as string,
      };

      const response = await fetch(`/api/businesses/${businessId}/compliance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`
        },
        body: JSON.stringify(complianceData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Submission failed');
      }

      setSuccess('Compliance information submitted successfully. Your application is under review.');
      await loadComplianceData(session);
      setActiveTab('overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenewal = async (documentType: string) => {
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const renewalData = {
        fiscalisationId: compliance!.id,
        documentType,
        storageKey: `temp-${Date.now()}`,
        fileName: `renewed_${documentType}_${Date.now()}.pdf`,
        newExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      const response = await fetch('/api/businesses/compliance/renewal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`
        },
        body: JSON.stringify(renewalData)
      });

      if (!response.ok) {
        throw new Error('Renewal submission failed');
      }

      setSuccess('Renewal submitted successfully. Your document is under review.');
      await loadComplianceData(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Renewal failed');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusInfo = (status: ComplianceStatus) => {
    const statusInfo: Record<ComplianceStatus, { color: string; icon: any; title: string; description: string }> = {
      DRAFT: {
        color: 'gray',
        icon: FileText,
        title: 'Draft',
        description: 'Complete all required fields and submit for verification'
      },
      PENDING_VERIFICATION: {
        color: 'blue',
        icon: Clock,
        title: 'Under Review',
        description: 'Your compliance information is being reviewed. This typically takes 1-3 business days.'
      },
      CHANGES_REQUIRED: {
        color: 'orange',
        icon: AlertTriangle,
        title: 'Changes Required',
        description: 'Your application requires corrections. Please review the feedback and update your information.'
      },
      COMPLIANT: {
        color: 'green',
        icon: CheckCircle,
        title: 'Compliant',
        description: 'Your business is fully compliant and can operate normally on ZimMarket.'
      },
      EXPIRING_SOON: {
        color: 'yellow',
        icon: AlertCircle,
        title: 'Expiring Soon',
        description: 'Your Tax Clearance Certificate is expiring soon. Upload the renewed certificate to prevent restrictions.'
      },
      EXPIRED: {
        color: 'red',
        icon: X,
        title: 'Expired',
        description: 'Your Tax Clearance Certificate has expired. New sales are restricted until you renew.'
      },
      DEVICE_INACTIVE: {
        color: 'red',
        icon: AlertTriangle,
        title: 'Device Inactive',
        description: 'Your fiscal device is inactive. Contact your fiscal device provider to restore connectivity.'
      },
      SUSPENDED: {
        color: 'red',
        icon: ShieldCheck,
        title: 'Suspended',
        description: 'Your business has been suspended due to compliance or policy issues. Contact support for details.'
      },
      UNDER_REVIEW: {
        color: 'orange',
        icon: Clock,
        title: 'Under Review',
        description: 'Your renewal or compliance change is under review.'
      },
    };

    return statusInfo[status];
  };

  const getMethodLabel = (method: FiscalisationMethod) => {
    const labels: Record<FiscalisationMethod, string> = {
      PHYSICAL_DEVICE: 'Physical Fiscal Device',
      FISCALISED_POS: 'Fiscalised Point-of-Sale System',
      VIRTUAL_DEVICE: 'Virtual Fiscal Device',
      FDMS_API: 'Accounting/POS System Integrated with FDMS',
    };
    return labels[method];
  };

  const canTrade = () => {
    if (!compliance) return false;
    const compliantStatuses = ['COMPLIANT', 'EXPIRING_SOON'];
    return compliantStatuses.includes(compliance.status) && 
           compliance.taxpayerActive && 
           compliance.deviceActive && 
           compliance.deviceRegistered &&
           new Date(compliance.taxClearanceExpiresAt) > new Date();
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading compliance information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="compliance-header">
        <div>
          <h1>Compliance & Verification</h1>
          <p>Manage your ZIMRA registration, fiscalisation, and tax clearance requirements</p>
        </div>
        <div className={`status-badge ${compliance ? getStatusInfo(compliance.status).color : 'gray'}`}>
          {compliance ? (
            <>
              {(() => {
                const Icon = getStatusInfo(compliance.status).icon;
                return <Icon size={20} />;
              })()}
              <span>{compliance ? getStatusInfo(compliance.status).title : 'Not Started'}</span>
            </>
          ) : (
            <>
              <FileText size={20} />
              <span>Not Started</span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle size={20} />
          <span>{success}</span>
          <button onClick={() => setSuccess('')}><X size={16} /></button>
        </div>
      )}

      {!compliance && (
        <div className="compliance-cta">
          <div className="compliance-cta-content">
            <ShieldCheck size={48} />
            <div>
              <h2>ZIMRA Registration Required</h2>
              <p>Your business cannot publish products, accept orders or receive marketplace payments until its required ZIMRA registration and fiscalisation information has been verified.</p>
              <p><strong>You can still:</strong></p>
              <ul>
                <li>Sign in and complete your profile</li>
                <li>Upload documents</li>
                <li>Add draft products</li>
                <li>Configure your storefront</li>
                <li>Contact support</li>
                <li>View your verification progress</li>
              </ul>
              <p><strong>You cannot:</strong></p>
              <ul>
                <li>Publish products or services</li>
                <li>Publish advertisements</li>
                <li>Open the shop to customers</li>
                <li>Accept new orders</li>
                <li>Accept marketplace payments</li>
                <li>Request payouts</li>
              </ul>
            </div>
          </div>
          <button 
            className="primary" 
            onClick={() => setActiveTab('submit')}
          >
            <Upload size={20} />
            Start Compliance Process
          </button>
        </div>
      )}

      {compliance && (
        <>
          <div className="tabs">
            <button 
              className={activeTab === 'overview' ? 'active' : ''} 
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={activeTab === 'submit' ? 'active' : ''} 
              onClick={() => setActiveTab('submit')}
            >
              Update Information
            </button>
            <button 
              className={activeTab === 'documents' ? 'active' : ''} 
              onClick={() => setActiveTab('documents')}
            >
              Documents
            </button>
            <button 
              className={activeTab === 'restrictions' ? 'active' : ''} 
              onClick={() => setActiveTab('restrictions')}
            >
              Restrictions
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="compliance-overview">
              <div className="status-card">
                <div className={`status-icon ${getStatusInfo(compliance.status).color}`}>
                  {(() => {
                    const Icon = getStatusInfo(compliance.status).icon;
                    return <Icon size={32} />;
                  })()}
                </div>
                <div className="status-details">
                  <h2>{getStatusInfo(compliance.status).title}</h2>
                  <p>{getStatusInfo(compliance.status).description}</p>
                  {compliance.nextReviewAt && (
                    <p className="next-review">
                      <Clock size={16} />
                      Next review: {new Date(compliance.nextReviewAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="compliance-grid">
                <div className="compliance-card">
                  <h3>Tax Registration</h3>
                  <div className="compliance-item">
                    <span>TIN:</span>
                    <strong>{compliance.tin}</strong>
                  </div>
                  <div className="compliance-item">
                    <span>Taxpayer Status:</span>
                    <span className={`status-indicator ${compliance.taxpayerActive ? 'success' : 'error'}`}>
                      {compliance.taxpayerActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {compliance.vatNumber && (
                    <div className="compliance-item">
                      <span>VAT Number:</span>
                      <strong>{compliance.vatNumber}</strong>
                    </div>
                  )}
                </div>

                <div className="compliance-card">
                  <h3>Tax Clearance Certificate</h3>
                  <div className="compliance-item">
                    <span>Certificate Number:</span>
                    <strong>{compliance.taxClearanceCertificateNumber}</strong>
                  </div>
                  <div className="compliance-item">
                    <span>Issue Date:</span>
                    <strong>{new Date(compliance.taxClearanceIssuedAt).toLocaleDateString()}</strong>
                  </div>
                  <div className="compliance-item">
                    <span>Expiry Date:</span>
                    <strong className={new Date(compliance.taxClearanceExpiresAt) < new Date() ? 'error' : 'success'}>
                      {new Date(compliance.taxClearanceExpiresAt).toLocaleDateString()}
                    </strong>
                  </div>
                </div>

                <div className="compliance-card">
                  <h3>Fiscal Device</h3>
                  <div className="compliance-item">
                    <span>Method:</span>
                    <strong>{getMethodLabel(compliance.method)}</strong>
                  </div>
                  <div className="compliance-item">
                    <span>Device Identifier:</span>
                    <strong>{compliance.deviceIdentifier}</strong>
                  </div>
                  {compliance.deviceModel && (
                    <div className="compliance-item">
                      <span>Model:</span>
                      <strong>{compliance.deviceModel}</strong>
                    </div>
                  )}
                  <div className="compliance-item">
                    <span>Device Status:</span>
                    <span className={`status-indicator ${compliance.deviceActive ? 'success' : 'error'}`}>
                      {compliance.deviceActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="compliance-item">
                    <span>Registered:</span>
                    <span className={`status-indicator ${compliance.deviceRegistered ? 'success' : 'error'}`}>
                      {compliance.deviceRegistered ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>

                <div className="compliance-card">
                  <h3>Trading Information</h3>
                  <div className="compliance-item">
                    <span>Registered Name:</span>
                    <strong>{compliance.registeredBusinessName}</strong>
                  </div>
                  <div className="compliance-item">
                    <span>Trading Name:</span>
                    <strong>{compliance.tradingName}</strong>
                  </div>
                  <div className="compliance-item">
                    <span>Authorized Representative:</span>
                    <strong>{compliance.authorisedRepresentative}</strong>
                  </div>
                </div>
              </div>

              {!canTrade() && (
                <div className="alert alert-warning">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>Store Restricted</strong>
                    <p>Your business cannot accept new orders while compliance requirements are being renewed. Existing customers can still track orders and contact support.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'submit' && (
            <div className="compliance-form">
              <h2>Update Compliance Information</h2>
              <p>Submit or update your ZIMRA registration and fiscalisation information.</p>
              
              <form onSubmit={handleSubmit}>
                <div className="form-section">
                  <h3>Business Information</h3>
                  <div className="form-grid">
                    <label>
                      Registered Business Name
                      <input 
                        name="registeredBusinessName" 
                        defaultValue={compliance?.registeredBusinessName}
                        required 
                        minLength={2}
                      />
                    </label>
                    <label>
                      Trading Name
                      <input 
                        name="tradingName" 
                        defaultValue={compliance?.tradingName}
                        required 
                        minLength={2}
                      />
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Tax Registration</h3>
                  <div className="form-grid">
                    <label>
                      ZIMRA TIN
                      <input 
                        name="tin" 
                        defaultValue={compliance?.tin}
                        required 
                        minLength={10}
                        maxLength={15}
                        pattern="[0-9]+"
                      />
                    </label>
                    <label>
                      VAT Number (Optional)
                      <input 
                        name="vatNumber" 
                        defaultValue={compliance?.vatNumber || ''}
                        maxLength={20}
                      />
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Tax Clearance Certificate</h3>
                  <div className="form-grid">
                    <label>
                      Certificate Number
                      <input 
                        name="taxClearanceCertificateNumber" 
                        defaultValue={compliance?.taxClearanceCertificateNumber}
                        required 
                        minLength={5}
                      />
                    </label>
                    <label>
                      Issue Date
                      <input 
                        type="date"
                        name="taxClearanceIssuedAt" 
                        defaultValue={compliance?.taxClearanceIssuedAt?.split('T')[0]}
                        required 
                      />
                    </label>
                    <label>
                      Expiry Date
                      <input 
                        type="date"
                        name="taxClearanceExpiresAt" 
                        defaultValue={compliance?.taxClearanceExpiresAt?.split('T')[0]}
                        required 
                      />
                    </label>
                    <label className="file-upload">
                      Tax Clearance Document
                      <div className="file-dropzone">
                        <Upload size={24} />
                        <span>Upload renewed certificate (PDF)</span>
                        <input type="file" accept=".pdf" />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Fiscalisation Method</h3>
                  <label>
                    Select Fiscalisation Method
                    <select 
                      name="method" 
                      defaultValue={compliance?.method}
                      required
                    >
                      <option value="">Select method...</option>
                      <option value="PHYSICAL_DEVICE">Physical Fiscal Device</option>
                      <option value="FISCALISED_POS">Fiscalised Point-of-Sale System</option>
                      <option value="VIRTUAL_DEVICE">Virtual Fiscal Device</option>
                      <option value="FDMS_API">Accounting/POS System Integrated with FDMS</option>
                    </select>
                  </label>
                </div>

                <div className="form-section">
                  <h3>Fiscal Device Information</h3>
                  <div className="form-grid">
                    <label>
                      Device Identifier
                      <input 
                        name="deviceIdentifier" 
                        defaultValue={compliance?.deviceIdentifier}
                        required 
                        minLength={2}
                      />
                    </label>
                    <label>
                      Device Model (Optional)
                      <input 
                        name="deviceModel" 
                        defaultValue={compliance?.deviceModel || ''}
                      />
                    </label>
                    <label>
                      Device Serial Number (Optional)
                      <input 
                        name="deviceSerialNumber" 
                        defaultValue={compliance?.deviceSerialNumber || ''}
                      />
                    </label>
                    <label>
                      Virtual Device Identifier (For Virtual Devices)
                      <input 
                        name="virtualDeviceIdentifier" 
                        defaultValue={compliance?.virtualDeviceIdentifier || ''}
                      />
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Supplier Information</h3>
                  <div className="form-grid">
                    <label>
                      Approved Supplier or Integrator
                      <input 
                        name="approvedSupplierOrIntegrator" 
                        defaultValue={compliance?.approvedSupplierOrIntegrator}
                        required 
                        minLength={2}
                      />
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Fiscal Receipt Verification</h3>
                  <div className="form-grid">
                    <label>
                      Receipt Verification Code
                      <input 
                        name="receiptVerificationCode" 
                        defaultValue={compliance?.receiptVerificationCode}
                        required 
                        minLength={4}
                      />
                    </label>
                    <label className="file-upload">
                      Sample Fiscal Receipt
                      <div className="file-dropzone">
                        <Upload size={24} />
                        <span>Upload sample fiscal receipt (PDF/Image)</span>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Authorised Representative</h3>
                  <label>
                    Full Name
                    <input 
                      name="authorisedRepresentative" 
                      defaultValue={compliance?.authorisedRepresentative}
                      required 
                      minLength={2}
                    />
                  </label>
                </div>

                <div className="form-actions">
                  <button type="button" onClick={() => setActiveTab('overview')}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit for Verification'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="documents-section">
              <h2>Compliance Documents</h2>
              <p>Upload and manage your compliance documents.</p>
              
              <div className="documents-list">
                {documents.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={48} />
                    <p>No documents uploaded yet</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="document-item">
                      <div className="document-info">
                        <div className="document-type">{doc.documentType}</div>
                        <div className="document-name">{doc.fileName}</div>
                        <div className="document-meta">
                          <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                          <span>{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                      <div className={`document-status ${doc.verificationStatus.toLowerCase()}`}>
                        {doc.verificationStatus}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button className="secondary">
                <Plus size={20} />
                Upload New Document
              </button>
            </div>
          )}

          {activeTab === 'restrictions' && (
            <div className="restrictions-section">
              <h2>Store Restrictions</h2>
              <p>Current restrictions on your business operations due to compliance status.</p>
              
              {restrictions.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle size={48} />
                  <p>No active restrictions - your business can operate normally</p>
                </div>
              ) : (
                <div className="restrictions-list">
                  {restrictions.map((restriction, index) => (
                    <div key={index} className="restriction-item">
                      <div className={`restriction-icon ${restriction.isRestricted ? 'error' : 'success'}`}>
                        {restriction.isRestricted ? <X size={20} /> : <CheckCircle size={20} />}
                      </div>
                      <div className="restriction-details">
                        <h3>{restriction.type.replace(/_/g, ' ')}</h3>
                        <p>{restriction.reason}</p>
                        <div className="restriction-dates">
                          <span>Imposed: {new Date(restriction.imposedAt).toLocaleDateString()}</span>
                          {restriction.liftedAt && (
                            <span>Lifted: {new Date(restriction.liftedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
