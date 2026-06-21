import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { addDoc, collection, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { AuditLog } from '../types';

export async function logAction(
  action: AuditLog['action'],
  resourceType: string,
  resourceId: string,
  details?: string
) {
  if (!auth.currentUser) return;
  try {
    await addDoc(collection(db, 'audit_logs'), {
      timestamp: serverTimestamp(),
      userUid: auth.currentUser.uid,
      userEmail: auth.currentUser.email || '',
      action,
      resourceType,
      resourceId,
      details: details || ''
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
}

export async function deleteRecord(collectionName: string, id: string, details: string) {
  try {
    await deleteDoc(doc(db, collectionName, id));
    await logAction('DELETE', collectionName, id, details);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}
