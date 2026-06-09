import re
content = open('D:/BodyBuildHealth/src/core/system-mechanisms.ts', 'r', encoding='utf-8').read()

systems = {
    'cardio': len(re.findall(r"id: 'cardio_", content)),
    'hepatic': len(re.findall(r"id: 'hepatic_", content)),
    'renal': len(re.findall(r"id: 'renal_", content)),
    'endocrine': len(re.findall(r"id: 'endocrine_", content)),
    'hematologic': len(re.findall(r"id: 'hematologic_", content)),
    'reproductive': len(re.findall(r"id: 'reproductive_", content)),
    'musculoskeletal': len(re.findall(r"id: 'musculoskeletal_", content)),
    'metabolic': len(re.findall(r"id: 'metabolic_", content)),
    'ghigf': len(re.findall(r"id: 'ghigf_", content)),
    'ins_axis': len(re.findall(r"id: 'ins_axis_", content)),
    'neuro_toxicity': len(re.findall(r"id: 'neuro_tox_", content)),
    'blood': len(re.findall(r"id: 'blood_", content)),
    'vessels': len(re.findall(r"id: 'vessels_", content)),
    'immunity': len(re.findall(r"id: 'immunity_", content)),
    'thyroid': len(re.findall(r"id: 'thyroid_", content)),
    'prostate': len(re.findall(r"id: 'prostate_", content)),
    'skin': len(re.findall(r"id: 'skin_", content)),
}

neuro_all = len(re.findall(r"id: 'neuro_", content))
neuro_tox = len(re.findall(r"id: 'neuro_tox_", content))
systems['neuro'] = neuro_all - neuro_tox

total = sum(systems.values())
for k, v in sorted(systems.items()):
    print(f'{k}: {v}')
print(f'Total: {total}')
