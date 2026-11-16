/*
 * Pegas Effects — After Effects FFX bridge
 * Run inside Adobe After Effects:
 *   File > Scripts > Run Script File...
 *
 * Select one target layer in an active composition, run this script, and choose
 * an .ffx preset. After Effects applies and interprets the preset; this script
 * exports the changed/new effects and readable parameters into the JSON schema
 * that Pegas Effects imports directly.
 *
 * FFX is a proprietary Adobe format. This bridge deliberately uses AE's own
 * scripting API instead of pretending to decode undocumented binary data.
 */
(function () {
    function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function str(v) { try { return String(v); } catch (e) { return ""; } }
    function finite(v) { return typeof v === "number" && isFinite(v); }
    function quote(s) {
        return '"' + str(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
            .replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t")
            .replace(/\u0008/g, "\\b").replace(/\u000c/g, "\\f") + '"';
    }
    function json(v) {
        if (v === null || v === undefined) return "null";
        if (typeof v === "string") return quote(v);
        if (typeof v === "number") return finite(v) ? String(v) : "null";
        if (typeof v === "boolean") return v ? "true" : "false";
        if (v instanceof Array) {
            var a = [];
            for (var i = 0; i < v.length; i++) a.push(json(v[i]));
            return "[" + a.join(",") + "]";
        }
        var fields = [];
        for (var k in v) if (own(v, k) && typeof v[k] !== "function")
            fields.push(quote(k) + ":" + json(v[k]));
        return "{" + fields.join(",") + "}";
    }
    function cleanValue(v) {
        if (v === null || v === undefined) return null;
        if (typeof v === "number") return finite(v) ? v : null;
        if (typeof v === "string" || typeof v === "boolean") return v;
        if (v instanceof Array) {
            var a = [];
            for (var i = 0; i < v.length; i++) a.push(cleanValue(v[i]));
            return a;
        }
        try {
            if (v.text !== undefined) return { text: str(v.text) };
        } catch (e1) {}
        return { sourceType: str(v.constructor && v.constructor.name || "object"), summary: str(v) };
    }
    function valueOf(p) {
        try {
            if (!p || p.propertyValueType === PropertyValueType.NO_VALUE) return null;
            return cleanValue(p.value);
        } catch (e) { return null; }
    }
    function easeArray(items) {
        var out = [];
        try {
            for (var i = 0; i < items.length; i++) {
                out.push({ speed: Number(items[i].speed), influence: Number(items[i].influence) });
            }
        } catch (e) {}
        return out;
    }
    function normalizedTime(time, layer) {
        var span = Math.max(0.000001, Number(layer.outPoint) - Number(layer.inPoint));
        return (Number(time) - Number(layer.inPoint)) / span;
    }
    function interpolation(p, index) {
        var a = "", b = "";
        try { a = str(p.keyInInterpolationType(index)).toLowerCase(); } catch (e1) {}
        try { b = str(p.keyOutInterpolationType(index)).toLowerCase(); } catch (e2) {}
        if (a.indexOf("hold") >= 0 || b.indexOf("hold") >= 0) return "hold";
        if (a.indexOf("bezier") >= 0 || b.indexOf("bezier") >= 0) return "bezier";
        return "linear";
    }
    function propertyData(p, layer) {
        if (!p) return null;
        var d = {
            name: str(p.name),
            matchName: str(p.matchName),
            propertyValueType: str(p.propertyValueType),
            value: valueOf(p),
            keys: [],
            expressionEnabled: false,
            expression: ""
        };
        try { d.expressionEnabled = !!p.expressionEnabled; } catch (e1) {}
        try { d.expression = str(p.expression || ""); } catch (e2) {}
        try {
            for (var i = 1; i <= p.numKeys; i++) {
                var kt = p.keyTime(i), kin = [], kout = [];
                try { kin = easeArray(p.keyInTemporalEase(i)); } catch (e3) {}
                try { kout = easeArray(p.keyOutTemporalEase(i)); } catch (e4) {}
                var key = {
                    t: normalizedTime(kt, layer),
                    compTime: kt,
                    value: cleanValue(p.keyValue(i)),
                    interpolation: interpolation(p, i),
                    inEase: kin,
                    outEase: kout,
                    temporalAutoBezier: false,
                    temporalContinuous: false
                };
                try { key.temporalAutoBezier = !!p.keyTemporalAutoBezier(i); } catch (e5) {}
                try { key.temporalContinuous = !!p.keyTemporalContinuous(i); } catch (e6) {}
                d.keys.push(key);
            }
        } catch (e7) {}
        return d;
    }
    function walkProperties(group, layer, prefix, result) {
        if (!group) return;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            var path = prefix ? prefix + "/" + str(p.name) : str(p.name);
            var isGroup = false;
            try {
                isGroup = p.propertyType !== PropertyType.PROPERTY && p.numProperties > 0;
            } catch (e) {}
            if (isGroup) walkProperties(p, layer, path, result);
            else {
                var data = propertyData(p, layer);
                if (data) { data.path = path; result.push(data); }
            }
        }
    }
    function findChild(group, names) {
        if (!group) return null;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            for (var j = 0; j < names.length; j++) {
                if (str(p.matchName) === names[j] || str(p.name) === names[j]) return p;
            }
        }
        return null;
    }
    function getTransform(layer) {
        var group = null;
        try { group = layer.property("ADBE Transform Group"); } catch (e) {}
        if (!group) return {};
        function prop(names) {
            var p = findChild(group, names);
            return p ? propertyData(p, layer) : null;
        }
        return {
            position: prop(["ADBE Position", "Position"]),
            scale: prop(["ADBE Scale", "Scale"]),
            rotation: prop(["ADBE Rotate Z", "ADBE Rotate", "Rotation"]),
            opacity: prop(["ADBE Opacity", "Opacity"]),
            anchorPoint: prop(["ADBE Anchor Point", "Anchor Point"])
        };
    }
    function getEffects(layer) {
        var list = [], parade = null;
        try { parade = layer.property("ADBE Effect Parade"); } catch (e) {}
        if (!parade) return list;
        for (var i = 1; i <= parade.numProperties; i++) {
            var effect = parade.property(i), props = [], enabled = true;
            walkProperties(effect, layer, "", props);
            try { enabled = !!effect.enabled; } catch (e1) {}
            list.push({
                name: str(effect.name),
                matchName: str(effect.matchName),
                enabled: enabled,
                stackIndex: i - 1,
                properties: props
            });
        }
        return list;
    }
    function signature(effect) { return str(effect.matchName) + "|" + str(effect.name); }
    function changedEffects(before, after) {
        var bySignature = {}, used = {}, result = [];
        for (var i = 0; i < before.length; i++) {
            var sig = signature(before[i]);
            if (!bySignature[sig]) bySignature[sig] = [];
            bySignature[sig].push(before[i]);
        }
        for (var j = 0; j < after.length; j++) {
            var current = after[j], sig2 = signature(current);
            var index = used[sig2] || 0;
            used[sig2] = index + 1;
            var previous = bySignature[sig2] && bySignature[sig2][index];
            if (!previous || json(previous) !== json(current)) result.push(current);
        }
        return result;
    }

    var comp = app.project && app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) {
        alert("Open a composition and select one layer before running the Pegas FFX bridge.");
        return;
    }
    if (!comp.selectedLayers || comp.selectedLayers.length !== 1) {
        alert("Select exactly one target layer in the active composition.");
        return;
    }
    var preset = File.openDialog("Choose an Adobe After Effects .ffx preset", "*.ffx");
    if (!preset || !preset.exists) return;

    var layer = comp.selectedLayers[0];
    var beforeEffects = getEffects(layer);
    var beforeTransform = getTransform(layer);

    app.beginUndoGroup("Pegas Effects — Apply FFX preset");
    try {
        layer.applyPreset(preset);
    } catch (e) {
        app.endUndoGroup();
        alert("After Effects could not apply this FFX preset:\n" + str(e));
        return;
    }
    app.endUndoGroup();

    var afterEffects = getEffects(layer);
    var afterTransform = getTransform(layer);
    var effects = changedEffects(beforeEffects, afterEffects);
    var transform = {};
    for (var key in afterTransform) if (own(afterTransform, key)) {
        if (afterTransform[key] && json(beforeTransform[key]) !== json(afterTransform[key])) {
            transform[key] = afterTransform[key];
        }
    }

    var data = {
        format: "cutroom-ae-export",
        version: 1,
        exporter: { name: "Pegas Effects FFX Bridge", version: "2.0" },
        source: {
            fileName: preset.name,
            sourceFormat: "Adobe After Effects FFX",
            parsedBy: "Adobe After Effects scripting API",
            exportedAt: (new Date()).toUTCString()
        },
        composition: {
            name: str(comp.name),
            width: comp.width,
            height: comp.height,
            frameRate: comp.frameRate,
            duration: comp.duration,
            frameDuration: comp.frameDuration
        },
        layer: {
            name: str(layer.name),
            index: layer.index,
            inPoint: layer.inPoint,
            outPoint: layer.outPoint,
            startTime: layer.startTime,
            stretch: layer.stretch,
            threeDLayer: !!layer.threeDLayer,
            sourceName: (layer.source && layer.source.name) ? str(layer.source.name) : ""
        },
        transform: transform,
        effects: effects,
        effectStackAfterApply: afterEffects,
        notes: [
            "Only new or changed effects are listed in effects; the full stack is preserved in effectStackAfterApply.",
            "Property values and keyframe times are read from After Effects after it applies the FFX preset.",
            "Keyframe times are normalized to the selected layer in/out range; compTime is also retained.",
            "Expressions are preserved as source text and are not executed by Pegas Effects.",
            "Unsupported plug-ins remain in sourceData/import diagnostics and are not replaced by invented values."
        ]
    };

    var target = File.saveDialog("Save Pegas Effects After Effects JSON export", "JSON:*.json");
    if (!target) return;
    if (!/\.json$/i.test(target.name)) target = new File(target.fsName + ".json");
    target.encoding = "UTF-8";
    target.lineFeed = "Unix";
    if (!target.open("w")) {
        alert("Could not write the JSON export: " + target.error);
        return;
    }
    target.write(json(data));
    target.close();
    alert("Pegas Effects JSON export created.\n\nChanged/new effects: " + effects.length +
        "\nChanged transforms: " + Object.keys(transform).length +
        "\n\nImport this JSON in Pegas Effects' Presets panel and review its compatibility report.");
})();
