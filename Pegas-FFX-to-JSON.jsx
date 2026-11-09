/*
 * Pegas Effects — After Effects FFX → JSON exporter
 * Run inside Adobe After Effects:
 *   File > Scripts > Run Script File...
 *
 * Usage:
 *   1. Select exactly one layer in an active composition.
 *   2. Run this script and choose an .ffx preset.
 *   3. The script applies the preset to the selected layer, reads the
 *      resulting supported properties/keyframes, and writes JSON.
 *
 * Important:
 *   .ffx is an Adobe proprietary preset format. This script uses After Effects
 *   itself to interpret it; it does not pretend to decode undocumented binary
 *   bytes in a browser. Expressions, plug-in internals and custom UI state
 *   cannot always be represented by a portable JSON preset.
 */
(function () {
    function quote(s) {
        return '"' + String(s).replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"').replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"';
    }

    function json(v) {
        if (v === null || v === undefined) return 'null';
        if (typeof v === 'string') return quote(v);
        if (typeof v === 'number') return isFinite(v) ? String(v) : 'null';
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        if (v instanceof Array) {
            var a = [];
            for (var i = 0; i < v.length; i++) a.push(json(v[i]));
            return '[' + a.join(',') + ']';
        }
        var parts = [];
        for (var k in v) if (v.hasOwnProperty(k))
            parts.push(quote(k) + ':' + json(v[k]));
        return '{' + parts.join(',') + '}';
    }

    function valueOf(p) {
        try {
            if (p.propertyValueType === PropertyValueType.NO_VALUE) return null;
            var v = p.value;
            if (v instanceof Array) {
                var a = [];
                for (var i = 0; i < v.length; i++) a.push(v[i]);
                return a;
            }
            if (typeof v === 'number' || typeof v === 'string' ||
                typeof v === 'boolean') return v;
            return String(v);
        } catch (_) { return null; }
    }

    function easeOf(e) {
        try {
            return {
                speed: e.speed,
                influence: e.influence
            };
        } catch (_) { return null; }
    }

    function serializeProperty(p, path) {
        var out = {
            name: p.name,
            matchName: p.matchName,
            propertyIndex: p.propertyIndex,
            propertyType: String(p.propertyType),
            valueType: String(p.propertyValueType),
            enabled: (typeof p.enabled === 'boolean') ? p.enabled : null,
            canSetExpression: !!p.canSetExpression,
            expression: (function () {
                try { return p.expression || ''; } catch (_) { return ''; }
            })(),
            path: path.slice(0)
        };

        if (p.propertyType === PropertyType.NAMED_GROUP ||
            p.propertyType === PropertyType.INDEXED_GROUP) {
            out.children = [];
            for (var i = 1; i <= p.numProperties; i++) {
                var child = p.property(i);
                out.children.push(serializeProperty(child, path.concat([{
                    name: child.name,
                    matchName: child.matchName,
                    index: i
                }])));
            }
            return out;
        }

        out.staticValue = valueOf(p);
        out.keyframes = [];
        try {
            for (var k = 1; k <= p.numKeys; k++) {
                var key = {
                    time: p.keyTime(k),
                    value: valueOf({ value: p.keyValue(k),
                        propertyValueType: p.propertyValueType }),
                    inInterpolation: String(p.keyInInterpolationType(k)),
                    outInterpolation: String(p.keyOutInterpolationType(k)),
                    inTemporalEase: [],
                    outTemporalEase: [],
                    temporalContinuous: null,
                    temporalAutoBezier: null,
                    roving: null
                };
                try {
                    var ie = p.keyInTemporalEase(k);
                    var oe = p.keyOutTemporalEase(k);
                    for (var q = 0; q < ie.length; q++) key.inTemporalEase.push(easeOf(ie[q]));
                    for (var z = 0; z < oe.length; z++) key.outTemporalEase.push(easeOf(oe[z]));
                } catch (_) {}
                try { key.temporalContinuous = p.keyTemporalContinuous(k); } catch (_) {}
                try { key.temporalAutoBezier = p.keyTemporalAutoBezier(k); } catch (_) {}
                try { key.roving = p.keyRoving(k); } catch (_) {}
                out.keyframes.push(key);
            }
        } catch (_) {}
        return out;
    }

    function findPresetEffects(layer) {
        var effects = [];
        try {
            var parade = layer.property("ADBE Effect Parade");
            if (!parade) return effects;
            for (var i = 1; i <= parade.numProperties; i++) {
                effects.push(serializeProperty(parade.property(i), [{
                    name: parade.property(i).name,
                    matchName: parade.property(i).matchName,
                    index: i
                }]));
            }
        } catch (_) {}
        return effects;
    }

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Open a composition and select one layer first.");
        return;
    }
    if (comp.selectedLayers.length !== 1) {
        alert("Select exactly one target layer, then run the exporter again.");
        return;
    }

    var preset = File.openDialog("Choose an After Effects .ffx preset", "*.ffx");
    if (!preset) return;
    if (!preset.exists) {
        alert("The selected preset file does not exist.");
        return;
    }

    var layer = comp.selectedLayers[0];
    var before = [];
    try {
        var paradeBefore = layer.property("ADBE Effect Parade");
        if (paradeBefore) {
            for (var b = 1; b <= paradeBefore.numProperties; b++)
                before.push(paradeBefore.property(b).matchName + "|" + paradeBefore.property(b).name);
        }
    } catch (_) {}

    app.beginUndoGroup("Pegas Effects — Apply and export FFX");
    try {
        layer.applyPreset(preset);
    } catch (e) {
        app.endUndoGroup();
        alert("After Effects could not apply this FFX preset:\n" + e.toString());
        return;
    }
    app.endUndoGroup();

    var allEffects = findPresetEffects(layer);
    var added = [];
    for (var i = 0; i < allEffects.length; i++) {
        var sig = allEffects[i].matchName + "|" + allEffects[i].name;
        var found = false;
        for (var j = 0; j < before.length; j++) if (before[j] === sig) found = true;
        if (!found) added.push(allEffects[i]);
    }

    var data = {
        format: "pegas-effects-ae-preset",
        schemaVersion: 1,
        source: {
            fileName: preset.name,
            filePath: preset.fsName,
            sourceFormat: "Adobe After Effects FFX",
            parsedBy: "Adobe After Effects scripting API",
            composition: comp.name,
            layer: layer.name,
            exportedAt: (new Date()).toUTCString()
        },
        compatibility: {
            note: "Values and keyframes are extracted from the layer after After Effects applied the FFX. Plug-in internals, expressions and unsupported property types may need manual mapping.",
            effectsAdded: added.length,
            fullEffectStackIncluded: true
        },
        effectsAdded: added,
        effectStackAfterApply: allEffects
    };

    var out = File.saveDialog("Save Pegas Effects JSON preset", "*.json");
    if (!out) return;
    if (!/\.json$/i.test(out.name)) out = new File(out.fsName + ".json");
    out.encoding = "UTF-8";
    if (!out.open("w")) {
        alert("Could not create the JSON output file.");
        return;
    }
    out.write(json(data));
    out.close();

    alert("JSON preset exported:\n" + out.fsName +
        "\n\nNew effects detected: " + added.length +
        "\n\nImport this JSON into Pegas Effects. Check unsupported plug-in properties before relying on an exact match.");
})();
