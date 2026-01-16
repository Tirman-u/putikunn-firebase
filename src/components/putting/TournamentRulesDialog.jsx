import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { X, Save } from 'lucide-react';
import ReactQuill from 'react-quill';

const DEFAULT_RULES = `<p><strong>Putting King</strong> on meeskondlik puttamisvõistlus, kus mängijad võistlevad paarikaupa erinevates puttamisjaamades. Mängu eesmärk on koguda etteantud punktisumma enne vastasmeeskonda.</p>

<p><strong>Eesmärkpunktisumma:</strong> 21 punkti</p>

<p><strong>Raundide arv:</strong> vaikimisi 6 raundi (seadistatav vahemikus 1–20)</p>

<p><strong>Võit:</strong> mängu võidab meeskond, kes jõuab esimesena täpselt 21 punktini</p>

<p><strong>Viik ja Sudden Death</strong></p>
<p>Kui mõlemad meeskonnad saavutavad 21 punkti samas raundis, järgneb <strong>Sudden Death</strong>:</p>
<ul>
<li>mängitakse lisa-voor</li>
<li>Sudden Death'i võitja teenib <strong>+1 lisapunkti</strong></li>
<li>lõpptulemus võib olla näiteks 21 : 22</li>
</ul>`;

export default function TournamentRulesDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedRules, setEditedRules] = useState('');

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['tournament-rules'],
    queryFn: async () => {
      const allRules = await base44.entities.TournamentRules.list();
      return allRules.length > 0 ? allRules[0] : null;
    }
  });

  const createRulesMutation = useMutation({
    mutationFn: (rulesText) => base44.entities.TournamentRules.create({
      rules_text: rulesText,
      last_updated_by: user?.email
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-rules'] });
      setIsEditing(false);
    }
  });

  const updateRulesMutation = useMutation({
    mutationFn: ({ id, rulesText }) => base44.entities.TournamentRules.update(id, {
      rules_text: rulesText,
      last_updated_by: user?.email
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-rules'] });
      setIsEditing(false);
    }
  });

  const handleEdit = () => {
    setEditedRules(rules?.rules_text || DEFAULT_RULES);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (rules?.id) {
      updateRulesMutation.mutate({ id: rules.id, rulesText: editedRules });
    } else {
      createRulesMutation.mutate(editedRules);
    }
  };

  const userRole = user?.app_role || 'user';
  const canEdit = ['admin', 'super_admin'].includes(userRole);
  const displayRules = rules?.rules_text || DEFAULT_RULES;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">Reeglid</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center text-slate-400">Loading...</div>
          ) : isEditing ? (
            <div className="min-h-[400px]">
              <ReactQuill
                value={editedRules}
                onChange={setEditedRules}
                theme="snow"
                className="h-[400px]"
                modules={{
                  toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'bullet' }, { 'list': 'ordered' }]
                  ]
                }}
                placeholder="Kirjuta reeglid siia..."
              />
            </div>
          ) : (
            <div className="prose prose-slate max-w-none text-sm" dangerouslySetInnerHTML={{ __html: displayRules }} />
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex gap-3">
          {canEdit && (
            <>
              {isEditing ? (
                <>
                  <Button
                    onClick={() => setIsEditing(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Tühista
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={createRulesMutation.isPending || updateRulesMutation.isPending}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvesta
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleEdit}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  Muuda Reegleid
                </Button>
              )}
            </>
          )}
          {!isEditing && (
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Sulge
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}