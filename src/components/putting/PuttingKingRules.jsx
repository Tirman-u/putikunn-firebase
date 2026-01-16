import React from 'react';

export default function PuttingKingRules({ tournament }) {
  const distances = tournament?.distances?.filter(d => d.enabled).sort((a, b) => a.order - b.order) || [
    { id: 'd1', label: '5m', points_for_made: 1, points_for_missed: 0 },
    { id: 'd2', label: '7m', points_for_made: 2, points_for_missed: -1 },
    { id: 'd3', label: '9m', points_for_made: 3, points_for_missed: -2 },
    { id: 'd4', label: '11m', points_for_made: 5, points_for_missed: -3 }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mt-4">
      <h2 className="text-xl font-bold text-slate-800 mb-4">Turniiri Reeglid</h2>
      
      <div className="space-y-4 text-sm text-slate-700">
        <p>
          <strong>Putting King</strong> on meeskondlik puttamisvõistlus, kus mängijad võistlevad paarikaupa erinevates puttamisjaamades. 
          Mängu eesmärk on koguda etteantud punktisumma enne vastasmeeskonda.
        </p>

        <div className="space-y-2">
          <p><strong>Eesmärkpunktisumma:</strong> {tournament?.target_score || 21} punkti</p>
          <p><strong>Raundide arv:</strong> {tournament?.total_rounds || 6} raundi (seadistatav vahemikus 1–20)</p>
          <p><strong>Võit:</strong> mängu võidab meeskond, kes jõuab esimesena täpselt {tournament?.target_score || 21} punktini</p>
        </div>

        <div>
          <p className="font-semibold text-slate-800 mb-2">Viik ja Sudden Death</p>
          <p className="mb-1">Kui mõlemad meeskonnad saavutavad {tournament?.target_score || 21} punkti samas raundis, järgneb <strong>Sudden Death</strong>:</p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>mängitakse lisa-voor</li>
            <li>Sudden Death'i võitja teenib <strong>+1 lisapunkti</strong></li>
            <li>lõpptulemus võib olla näiteks 21 : 22</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-slate-800 mb-2">Punktiarvestus (distantsid ja punktid)</p>
          <p className="mb-2">Punktid jagatakse vastavalt puttamise distantsile ja tulemusele. Vaikimisi kasutatakse järgmisi seadeid:</p>
          
          <div className="space-y-3 pl-4">
            {distances.map((d) => (
              <div key={d.id}>
                <p className="font-medium text-slate-800">{d.label}</p>
                <ul className="list-disc list-inside pl-4 text-xs">
                  <li>Sisse: <strong>{d.points_for_made > 0 ? '+' : ''}{d.points_for_made} {d.points_for_made === 1 ? 'punkt' : 'punkti'}</strong></li>
                  <li>Mööda: <strong>{d.points_for_missed > 0 ? '+' : ''}{d.points_for_missed} {Math.abs(d.points_for_missed) === 1 ? 'punkt' : 'punkti'}</strong></li>
                </ul>
              </div>
            ))}
          </div>
          
          <p className="text-xs text-slate-500 italic mt-2">
            Märkus: Distantside ja punktide väärtusi saab turniiri loomisel vabalt seadistada.
          </p>
        </div>

        <div>
          <p className="font-semibold text-slate-800 mb-2">Mängijate jaotamine ja meeskonnad</p>
          <p className="font-medium mb-1">Üldpõhimõtted</p>
          <ul className="list-disc list-inside space-y-1 pl-4 mb-3">
            <li>Igas jaamas mängib <strong>4 mängijat</strong></li>
            <li>Mängijad jagatakse kahte kaheliikmelisse meeskonda (<strong>Meeskond A</strong> ja <strong>Meeskond B</strong>)</li>
            <li>Turniiri alustamiseks on vaja vähemalt 4 mängijat iga jaama kohta (nt 2 jaama = vähemalt 8 mängijat)</li>
          </ul>

          <p className="font-medium mb-1">Raundide loogika</p>
          <div className="space-y-2 pl-4">
            <div>
              <p className="font-medium text-slate-700">Esimene raund:</p>
              <ul className="list-disc list-inside pl-4 text-xs">
                <li>mängijad jaotatakse juhuslikult meeskondadesse ja jaamadesse</li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium text-slate-700">Järgmised raundid:</p>
              <ul className="list-disc list-inside pl-4 text-xs">
                <li>süsteem püüab vältida sama partneriga korduvat mängimist</li>
                <li>eesmärk on võimalikult vaheldusrikas ja õiglane mäng</li>
                <li>arvesse võetakse varasemaid tulemusi (punktid ja võidud), et jaotada tugevamad mängijad meeskondade vahel ühtlasemalt</li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-slate-700">Iga raund on eraldiseisev mäng</p>
              <ul className="list-disc list-inside pl-4 text-xs">
                <li>iga raund algab puhtalt</li>
                <li>raundi lõpus selgub võitja ja kaotaja</li>
                <li>raundi jooksul teenitud punktid lisatakse turniiri üldskoori</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <p className="font-semibold text-slate-800 mb-2">Turniiri punktisüsteem ja edetabel</p>
          
          <p className="font-medium mb-1">Individuaalne arvestus</p>
          <ul className="list-disc list-inside space-y-1 pl-4 mb-3">
            <li>Iga mängija teenib turniiri punkte vastavalt oma meeskonna tulemustele</li>
            <li><strong>Iga mängus kogutud punkt loeb turniiri üldarvestusse</strong></li>
          </ul>

          <p className="font-medium mb-1">Edetabel</p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>Turniiri edetabelit uuendatakse reaalajas</li>
            <li>Edetabel kajastab:
              <ul className="list-disc list-inside pl-6 mt-1">
                <li>võite ja kaotusi</li>
                <li>kogutud turniiri punkte</li>
                <li>mängijate üldist paremusjärjestust</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}