import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const FORMAT_RULES = {
  classic: {
    title: 'Classic Rules',
    range: '5m - 10m',
    start: '10m',
    rules: [
      'Start at 10m, throw 5 discs',
      'Based on makes, next distance:',
      '0 makes → 5m',
      '1 make → 6m',
      '2 makes → 7m',
      '3 makes → 8m',
      '4 makes → 9m',
      '5 makes → 10m',
      'Points = distance × makes',
      'Play 20 rounds (100 putts total)'
    ]
  },
  short: {
    title: 'Short Rules',
    range: '3m - 8m',
    start: '8m',
    rules: [
      'Start at 8m, throw 5 discs',
      'Based on makes, next distance:',
      '0 makes → 3m',
      '1 make → 4m',
      '2 makes → 5m',
      '3 makes → 6m',
      '4 makes → 7m',
      '5 makes → 8m',
      'Points = distance × makes',
      'Play 20 rounds (100 putts total)'
    ]
  },
  long: {
    title: 'Long Rules',
    range: '10m - 15m',
    start: '15m',
    rules: [
      'Start at 15m, throw 5 discs',
      'Based on makes, next distance:',
      '0 makes → 10m',
      '1 make → 11m',
      '2 makes → 12m',
      '3 makes → 13m',
      '4 makes → 14m',
      '5 makes → 15m',
      'Points = distance × makes',
      'Play 20 rounds (100 putts total)'
    ]
  },
  back_and_forth: {
    title: 'Back & Forth Rules',
    range: '5m - 10m',
    start: '5m',
    rules: [
      'Start at 5m, throw 1 disc at a time',
      'If made → distance +1m',
      'If missed → distance -1m',
      'Distance stays between 5m-10m',
      'Each made putt scores its distance',
      'Example: make from 7m = 7 points',
      'Play 20 rounds (100 putts total)'
    ]
  }
};

export default function FormatRulesPopup({ format }) {
  const rules = FORMAT_RULES[format] || FORMAT_RULES.classic;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
          <HelpCircle className="w-5 h-5 text-slate-400 hover:text-slate-600" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{rules.title}</DialogTitle>
          <div className="text-sm text-slate-500">
            Range: {rules.range} • Start: {rules.start}
          </div>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-slate-700 mt-4">
          {rules.rules.map((rule, idx) => (
            <li key={idx} className={rule.includes('→') ? 'ml-4' : ''}>
              {rule.includes('→') ? '• ' : '• '}{rule}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}