import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { logAction } from '../services/audit';
import { STATUS_OPTIONS } from '../types';
import { cn } from '../lib/utils';

export function StatusSelect({ 
  patientId, 
  currentStatus, 
  canEdit 
}: { 
  patientId: string, 
  currentStatus: string, 
  canEdit: boolean 
}) {
  const handleStatusChange = async (newStatus: string) => {
    try {
      await setDoc(doc(db, 'patients', patientId), { 
        status: newStatus,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      await logAction('UPDATE', 'patients', patientId, `Updated status to ${newStatus}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `patients/${patientId}`);
    }
  };

  const option = STATUS_OPTIONS.find(o => o.value === currentStatus) || STATUS_OPTIONS[0];

  if (!canEdit) {
    return (
      <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold uppercase inline-block", option.color)}>
        {option.label}
      </span>
    );
  }

  return (
    <select
      value={currentStatus}
      onChange={(e) => handleStatusChange(e.target.value)}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-bold uppercase outline-none border-none cursor-pointer transition-all appearance-none text-center min-w-[140px]",
        option.color
      )}
    >
      {STATUS_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value} className="bg-white text-slate-900 uppercase font-bold">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
