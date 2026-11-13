"""Patch only intake in the exact published function, preserving its other code/dependencies."""
import hashlib, pathlib, sys, zipfile, difflib, json, copy
base, out = map(pathlib.Path, sys.argv[1:3])
assert hashlib.sha256(base.read_bytes()).hexdigest() == '899bc18c0878562d2692f4f385fdccf9d3b098d39e43ebd28bdc75ba5679d886'
entry = 'netlify/functions/automation.cjs'
with zipfile.ZipFile(base) as archive:
    original = archive.read(entry).decode()
    def once(s, old, new):
        assert s.count(old) == 1, ('Patch anchor mismatch', old[:80])
        return s.replace(old, new, 1)
    start, end = original.index('const intakeSchema = '), original.index('var briefSchema = ')
    schema = original[start:end]
    schema = once(schema, 'companyName: text(160),', 'companyName: import_zod2.z.string().trim().max(160).default(""),')
    schema = once(schema, r'phone: import_zod2.z.string().trim().regex(/^\+?[\d\s().-]{8,25}$/),', r'phone: import_zod2.z.string().trim().refine(value => value === "" || /^\+?[\d\s().-]{8,25}$/.test(value), "Téléphone invalide.").default(""),')
    for key in ['city', 'businessType']:
        schema = once(schema, key + ': text(100),', key + ': import_zod2.z.string().trim().max(100).default(""),')
    schema = once(schema, 'professional: import_zod2.z.literal(true),', 'professional: import_zod2.z.boolean(),')
    changed = original[:start] + schema + original[end:]
    start, end = changed.index('async function createIntake(input) {'), changed.index('async function submitBrief(')
    intake = changed[start:end]
    intake = once(intake, 'const prospect = await tx.prospect.upsert({', 'const prospect = data.professional && data.phone && data.companyName ? await tx.prospect.upsert({')
    intake = once(intake, '      });\n      const project = await tx.salesProject.create({', '      }) : null;\n      const project = await tx.salesProject.create({')
    intake = once(intake, '          requestKey: data.requestKey,', '          clientType: data.professional ? "PROFESSIONAL" : "INDIVIDUAL",\n          requestKey: data.requestKey,')
    # Company/name fallback applies to the project only, not the prospect deduplication.
    a = intake.index('      const project = ')
    intake = intake[:a] + once(intake[a:], 'companyName: data.companyName,', 'companyName: data.companyName || data.contactName,')
    intake = once(intake, 'prospectId: prospect.id\n', 'prospectId: prospect?.id || null\n')
    intake = once(intake, '      await tx.followUp.create({', '      if (prospect) await tx.followUp.create({')
    intake = once(intake, '      await tx.prospectInteraction.create({', '      if (prospect) await tx.prospectInteraction.create({')
    old = r'detail: "Demande professionnelle re\xE7ue ; information relative aux donn\xE9es accept\xE9e."'
    intake = once(intake, old, r'detail: data.professional ? "Demande professionnelle re\xE7ue ; information relative aux donn\xE9es accept\xE9e." : "Demande de particulier reçue ; information relative aux données acceptée."')
    changed = changed[:start] + intake + changed[end:]
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, 'w') as result:
        for info in archive.infolist():
            result.writestr(copy.copy(info), changed.encode() if info.filename == entry else archive.read(info.filename))
    with zipfile.ZipFile(out) as result:
        assert archive.namelist() == result.namelist()
        differences = [n for n in archive.namelist() if archive.read(n) != result.read(n)]
        assert differences == [entry]
    out.with_suffix('.cjs').write_text(changed)
    out.with_suffix('.diff').write_text(''.join(difflib.unified_diff(original.splitlines(True), changed.splitlines(True), fromfile='live', tofile='quote-form')))
    print(json.dumps({'changedEntries':differences,'unchangedEntries':len(archive.namelist())-1,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
