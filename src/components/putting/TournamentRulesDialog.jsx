import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Save } from 'lucide-react';

const DEFAULT_RULES = `# Putting King Võistluse Reeglid

## Mängu Formaat
• 2v2 võistkondlik turniir
• Mäng kestab kuni 21 punktini
• Bust'i korral tagasi 11 punktile

## Punktisüsteem
• Võit: 2 punkti
• Viik: 1 punkt
• Kaotus: 0 punkti

## Kaugused ja Punktid
• 5m: +1 punkt (sisse) / 0 punkti (mööda)
• 7m: +2 punkti (sisse) / -1 punkt (mööda)
• 9m: +3 punkti (sisse) / -2 punkti (mööda)
• 11m: +5 punkti (sisse) / -3 punkti (mööda)

## Ringide Arv
• Kokku 6 ringi
• Peale iga ringi toimub rotatsioon

## Lisaküsimuste Korral
Võta ühendust korraldajaga.`;

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
            <Textarea
              value={editedRules}
              onChange={(e) => setEditedRules(e.target.value)}
              className="w-full h-96 font-mono text-sm"
              placeholder="Sisesta reeglid..."
            />
          ) : (
            <div className="prose prose-slate max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{displayRules}</pre>
            </div>
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