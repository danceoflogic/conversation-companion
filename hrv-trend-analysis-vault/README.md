# HRV Trend Analysis Vault

Purpose: maintain a long-term, Obsidian-friendly record of HRV, sleep, training, recovery, and subjective state so patterns can be reviewed over days, weeks, and months.

This vault is designed for trend analysis, not diagnosis. It is a performance and recovery log: a cockpit, not a courtroom.

---

## Folder Structure

```text
hrv-trend-analysis-vault/
├── README.md
├── 00_daily-logs/
├── 01_raw-data/
│   ├── kubios/
│   ├── sleep-app/
│   └── screenshots/
├── 02_weekly-reviews/
├── 03_monthly-trends/
├── 04_protocols/
├── 05_templates/
└── 06_charts-and-exports/
```

---

## Core Metrics To Track

| Field | Meaning | Notes |
|---|---|---|
| date | Calendar date | Use YYYY-MM-DD |
| time | Reading time | AM rest, PM activity, pre-sleep, etc. |
| context | Situation | waking, after swim, after yoga, after poor sleep |
| HR | Heart rate | bpm |
| rMSSD | Parasympathetic recovery marker | useful for daily readiness trends |
| SDNN | Overall HRV variability | useful for broader stress/load picture |
| LF | Low-frequency power | from Kubios if available |
| HF | High-frequency power | from Kubios if available |
| LF/HF | Sympathovagal balance estimate | interpret cautiously |
| HF% | HF as percentage | useful for parasympathetic dominance/rebound |
| Stress Index | Kubios-style stress/load value | trend over time, not single-reading panic button |
| sleep_score | Sleep app score | optional |
| sleep_duration | Total sleep time | optional |
| deep_sleep | Deep sleep duration | optional |
| awake_time | Awake time | optional |
| training_load | Main physical stressor | ballet, swim, gym, yoga, synchro, etc. |
| notes | Subjective notes | mood, pain, digestion, hydration, caffeine, heat, stress |

---

## Daily Log Template

```markdown
# HRV Daily Log - YYYY-MM-DD

## Readings

| Time | Context | HR | rMSSD | SDNN | LF/HF | HF% | Stress Index | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|
| AM | waking/rest |  |  |  |  |  |  |  |
| PM | later reading |  |  |  |  |  |  |  |

## Sleep

- Sleep duration:
- Sleep score:
- Deep sleep:
- Awake time:
- Sleep quality notes:

## Training / Physical Load

- Main activity:
- Intensity:
- Duration:
- Recovery feeling:

## Subjective State

- Energy:
- Mood:
- Digestion/stomach:
- Pain/tension:
- Stress level:
- Hydration/nutrition:

## Pattern Interpretation

- Autonomic state:
- Likely drivers:
- Early waking risk:
- Training readiness:

## Next-Day Adjustment

- Best training choice:
- Recovery priority:
- Sleep protection plan:
```

---

## Weekly Review Template

```markdown
# HRV Weekly Review - Week Starting YYYY-MM-DD

## Summary

- Best recovery day:
- Lowest readiness day:
- Main stressors:
- Best sleep night:
- Worst sleep night:

## Trend Notes

- rMSSD trend:
- SDNN trend:
- LF/HF trend:
- HF% trend:
- Stress Index trend:

## Training Correlations

- Activities that improved next-day readiness:
- Activities that worsened next-day readiness:
- Best day for high-skill work:
- Best day for heavy training:

## Sleep / Early Waking Pattern

- Early waking episodes:
- Likely triggers:
- Successful interventions:

## Next Week Strategy

- Load plan:
- Recovery anchors:
- Sleep protection:
```

---

## Interpretation Rules

1. Never over-read one isolated HRV reading.
2. Compare readings to personal baseline, not generic population norms.
3. Track the direction of change: stable, rising, falling, rebound, crash.
4. Separate true recovery from exhausted parasympathetic rebound.
5. Check context before conclusion: sleep, heat, dehydration, food, stress, training, illness, pain.
6. Use HRV to adjust load, not to imprison the day.

---

## Useful Pattern Labels

| Pattern | Description | Common Meaning |
|---|---|---|
| Stable-ready | HR normal, rMSSD stable/good, stress low | good capacity |
| Sympathetic-load | HR up, rMSSD down, stress up | load, stress, dehydration, poor sleep |
| Parasympathetic-rebound | HR low/normal, HF% high, energy low | recovery rebound or fatigue dip |
| Fragile-ready | numbers look okay but subjective energy poor | proceed gently |
| Overreached | HR up, rMSSD down, SDNN down, stress high | deload signal |
| Activated-night | difficulty sleeping, early waking, high alertness | nervous system too switched on |

---

## CSV Schema

```csv
date,time,context,hr,rmssd,sdnn,lf,hf,lf_hf,hf_percent,stress_index,sleep_score,sleep_duration,deep_sleep,awake_time,training_load,notes
```

---

## First Tasks

- Create a daily log in `00_daily-logs/`.
- Add raw Kubios exports to `01_raw-data/kubios/`.
- Add sleep screenshots or exports to `01_raw-data/sleep-app/`.
- Write one weekly review every Sunday.
- Keep interpretations short but consistent.

---

## Working Principle

The goal is not to worship the numbers. The goal is to spot the rhythm: load, recovery, rebound, adaptation. Tiny signals become useful only when they march together over time.
