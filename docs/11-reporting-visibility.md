# Reporting Visibility

## Problem
Manual dashboard updates and a hand-maintained progress feed made the project appear stale even while work continued.

## Fix Direction
Use an automatically generated progress feed based on real filesystem modification times so the dashboard can show recent actual changes.

## Near-Term Rules
- Distinguish milestone progress from recent activity.
- Show feed scan time.
- Prefer auto-generated change lists over manually curated ones.
- Keep execution state visible separately from milestone percentages.
