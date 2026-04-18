# Macro Snapshot Data Shapes

## fedFundsRate (from FRED)
```json
{
  "seriesId": "FEDFUNDS",
  "title": "Federal Funds Effective Rate",
  "frequency": "Monthly",
  "units": "Percent",
  "lastUpdated": "2026-04-01 15:17:15-05",
  "source": "FRED",
  "observations": [
    { "date": "2026-03-01", "value": 3.64 },
    ...
  ]
}
```
Latest value: observations[0].value = 3.64

## cpi (from FRED)
Same shape as fedFundsRate but with CPI data.
Latest value: observations[0].value

## unemployment (from FRED)
Same shape. Latest value: observations[0].value

## treasuryYields (from Treasury)
Array of objects:
```json
[
  { "record_date": "2026-03-31", "security_type_desc": "...", "security_desc": "...", "avg_interest_rate_amt": "3.702" }
]
```

## totalNonfarmPayrolls (from BLS)
```json
{
  "seriesID": "CES0000000001",
  "data": [
    { "year": "2026", "period": "M03", "periodName": "March", "value": 159181, "footnotes": [{}] }
  ]
}
```
Latest value: data[0].value (in thousands)
