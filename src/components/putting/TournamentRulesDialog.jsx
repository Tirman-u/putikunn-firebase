import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { X, Save } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';

const rulesStyle = `
  .rules-content ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
  .rules-content ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
  .rules-content li { margin: 0.25rem 0; }
  .rules-content p { margin: 0.5rem 0; }
  .rules-content strong { font-weight: 600; }
  .rules-content em { font-style: italic; }
  .rules-content u { text-decoration: underline; }
`;

const DEFAULT_RULES = `<p><strong>Putting King</strong> on meeskondlik puttamisvõistlus...</p>`;

export default function TournamentRulesDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedRules, setEditedRules] = useState('');
  const currentUser = auth.currentUser;

  const { data: user } = useQuery({
    queryKey: ['user', currentUser?.uid],
    queryFn: async () => {
      if (!currentUser) return null;
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      return userDoc.exists() ? { ...userDoc.data(), email: currentUser.email, uid: currentUser.uid } : { email: currentUser.email, uid: currentUser.uid, role: 'user' };
    },
    enabled: !!currentUser,
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['tournament-rules'],
    queryFn: async () => {
      const rulesDocRef = doc(db, 'rules', 'main');
      const rulesDoc = await getDoc(rulesDocRef);
      return rulesDoc.exists() ? { id: rulesDoc.id, ...rulesDoc.data() } : null;
    },
  });

  const saveRulesMutation = useMutation({
    mutationFn: (rulesText) => {
      const rulesRef = doc(db, 'rules', 'main');
      return setDoc(rulesRef, { 
        rules_text: rulesText, 
        last_updated_by: user?.email, 
        updated_at: new Date().toISOString() 
      }, { merge: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-rules'] });
      setIsEditing(false);
      toast.success('Reeglid salvestatud');
    },
    onError: (error) => {
      toast.error('Reeglite salvestamine ebaõnnestus');
    }
  });

  const handleEdit = () => {
    setEditedRules(rules?.rules_text || DEFAULT_RULES);
    setIsEditing(true);
  };

  const handleSave = () => {
    saveRulesMutation.mutate(editedRules);
  };

  const canEdit = user && ['admin', 'super_admin'].includes(user.role);
  const displayRules = rules?.rules_text || DEFAULT_RULES;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <style>{rulesStyle}</style>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">Reeglid</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center text-slate-400">Laen...</div>
          ) : isEditing ? (
            <div className="min-h-[400px]">
              <ReactQuill
                value={editedRules}
                onChange={setEditedRules}
                theme="snow"
                className="h-[400px]"
                modules={{ toolbar: [['bold', 'italic', 'underline'], [{ list: 'bullet' }, { list: 'ordered' }]] }}
                placeholder="Kirjuta reeglid siia..."
              />
            </div>
          ) : (
            <div className="rules-content text-slate-700" dangerouslySetInnerHTML={{ __html: displayRules }} />
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex gap-3">
          {canEdit && (
            <>
              {isEditing ? (
                <>
                  <Button onClick={() => setIsEditing(false)} variant="outline" className="flex-1">Tühista</Button>
                  <Button onClick={handleSave} disabled={saveRulesMutation.isPending} className="flex-1 bg-purple-600 hover:bg-purple-700">
                    <Save className="w-4 h-4 mr-2" />
                    Salvesta
                  </Button>
                </>
              ) : (
                <Button onClick={handleEdit} className="flex-1 bg-purple-600 hover:bg-purple-700">Muuda Reegleid</Button>
              )}
            </>
          )}
          {!isEditing && <Button onClick={onClose} variant="outline" className="flex-1">Sulge</Button>}
        </div>
      </div>
    </div>
  );
}
