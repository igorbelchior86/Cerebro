'use client';

import { useState } from 'react';

interface ProfileModalProps {
    open: boolean;
    onClose: () => void;
    currentName: string;
    currentJobTitle?: string;
    currentAvatar?: string | null;
    onSave: (name: string, jobTitle: string, photoFile: File | null) => void;
}

export default function ProfileModal({ open, onClose, currentName, currentJobTitle = '', currentAvatar, onSave }: ProfileModalProps) {
    const [name, setName] = useState(currentName);
    const [jobTitle, setJobTitle] = useState(currentJobTitle);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const displayAvatar = preview || currentAvatar;

    if (!open) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            setFile(selected);
            const url = URL.createObjectURL(selected);
            setPreview(url);
        }
    };

    const handleSave = () => {
        onSave(name, jobTitle, file);
        onClose();
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />

            <div className="animate-fadeIn" style={{ position: 'relative', width: '100%', maxWidth: '400px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Edit Profile</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: '4px' }}>✕</button>
                </div>

                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Photo upload */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: displayAvatar ? `url(${displayAvatar}) center/cover` : 'var(--bg-card-hover)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {!displayAvatar && <span style={{ color: 'var(--text-faint)', fontSize: '24px' }}>📷</span>}
                        </div>
                        <div>
                            <label style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--accent)', background: 'rgba(91,127,255,0.1)', padding: '6px 12px', borderRadius: '6px' }}>
                                Upload Photo
                                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                            </label>
                            <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: '6px 0 0' }}>Recommended: Square JPG or PNG, max 2MB.</p>
                        </div>
                    </div>

                    {/* Name input */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Display Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-root)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                        />
                    </div>

                    {/* Job Title input */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Job Title</label>
                        <input
                            type="text"
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            placeholder="e.g. L2 Engineer"
                            style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-root)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                        />
                    </div>
                </div>

                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--bg-sidebar)' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: 'white', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Save Changes</button>
                </div>
            </div>
        </div>
    );
}
