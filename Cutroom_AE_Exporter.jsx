/*
  Cutroom After Effects Layer Exporter
  ------------------------------------
  Run from After Effects: File > Scripts > Run Script File…
  Select one layer in an active composition before running.

  Exports a JSON description of the selected layer, all effect-stack entries
  in their original order, leaf property values, supported keyframes, temporal
  interpolation/ease metadata, expressions as text, and transform properties.

  Cutroom maps only parameters it understands. Expressions are preserved as
  text and are NOT executed by Cutroom. Unsupported plug-ins/properties remain
  in the JSON sourceData so the import report can identify them.
*/
(function () {
    function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function str(v) { try { return String(v); } catch (e) { return ""; } }
    function finite(v) { return typeof v === "number" && isFinite(v); }
    function cleanValue(v) {
        if (v === null || v === undefined) return null;
        if (typeof v === "number") return finite(v) ? v : null;
        if (typeof v === "string" || typeof v === "boolean") return v;
        if (v instanceof Array) {
            var a = [];
            for (var i = 0; i < v.length; i++) a.push(cleanValue(v[i]));
            return a;
        }
        // TextDocument / shape-like values cannot be executed by Cutroom.
        // Keep a readable summary instead of dropping the source property.
        try {
            if (v.text !== undefined) return { text: str(v.text) };
        } catch (e1) {}
        return { sourceType: str(v.constructor && v.constructor.name || "object"), summary: str(v) };
    }
    function jsonQuote(s) {
        return '"' + str(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
            .replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t")
            .replace(/\u0008/g, "\\b").replace(/\u000c/g, "\\f") + '"';
    }
    function stringify(v) {
        if (v === null || v === undefined) return "null";
        if (typeof v === "string") return jsonQuote(v);
        if (typeof v === "number") return isFinite(v) ? String(v) : "null";
        if (typeof v === "boolean") return v ? "true" : "false";
        if (v instanceof Array) {
            var ar = [];
            for (var i = 0; i < v.length; i++) ar.push(stringify(v[i]));
            return "[" + ar.join(",") + "]";
        }
        var fields = [];
        for (var k in v) if (own(v, k) && typeof v[k] !== "function")
            fields.push(jsonQuote(k) + ":" + stringify(v[k]));
        return "{" + fields.join(",") + "}";
    }
    function normalizedTime(t, layer) {
        var span = Math.max(0.000001, layer.outPoint - layer.inPoint);
        var u = (t - layer.inPoint) / span;
        return Math.max(0, Math.min(1, u));
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
    function interpolationName(p, index) {
        var a = "", b = "";
        try { a = str(p.keyInInterpolationType(index)); } catch (e1) {}
        try { b = str(p.keyOutInterpolationType(index)); } catch (e2) {}
        if (a.toLowerCase().indexOf("hold") >= 0 || b.toLowerCase().indexOf("hold") >= 0) return "hold";
        if (a.toLowerCase().indexOf("bezier") >= 0 || b.toLowerCase().indexOf("bezier") >= 0) return "bezier";
        return "linear";
    }
    function temporalAutoBezier(p, index) {
        try { return !!p.keyTemporalAutoBezier(index); } catch (e) { return false; }
    }
    function temporalContinuous(p, index) {
        try { return !!p.keyTemporalContinuous(index); } catch (e) { return false; }
    }
    function propertyData(p, layer) {
        if (!p) return null;
        var d = {
            name: str(p.name),
            matchName: str(p.matchName),
            propertyValueType: str(p.propertyValueType),
            value: null,
            keys: [],
            expressionEnabled: false,
            expression: ""
        };
        try { d.value = cleanValue(p.value); } catch (e1) {}
        try { d.expressionEnabled = !!p.expressionEnabled; } catch (e2) {}
        try { d.expression = str(p.expression || ""); } catch (e3) {}
        try {
            for (var i = 1; i <= p.numKeys; i++) {
                var kt = p.keyTime(i), kv = cleanValue(p.keyValue(i));
                var kin = [], kout = [];
                try { kin = easeArray(p.keyInTemporalEase(i)); } catch (e4) {}
                try { kout = easeArray(p.keyOutTemporalEase(i)); } catch (e5) {}
                d.keys.push({
                    t: normalizedTime(kt, layer),
                    compTime: kt,
                    value: kv,
                    interpolation: interpolationName(p, i),
                    inEase: kin,
                    outEase: kout,
                    temporalAutoBezier: temporalAutoBezier(p, i),
                    temporalContinuous: temporalContinuous(p, i)
                });
            }
        } catch (e6) {}
        return d;
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
    function walkProperties(group, layer, prefix, result) {
        if (!group) return;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i), path = prefix ? prefix + "/" + str(p.name) : str(p.name);
            var isGroup = false;
            try { isGroup = p.propertyType !== PropertyType.PROPERTY && p.numProperties > 0; } catch (e) { isGroup = false; }
            if (isGroup) {
                walkProperties(p, layer, path, result);
            } else {
                var data = propertyData(p, layer);
                if (data) {
                    data.path = path;
                    result.push(data);
                }
            }
        }
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
            var effect = parade.property(i), props = [];
            walkProperties(effect, layer, "", props);
            var enabled = true;
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
    var comp = app.project && app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) {
        alert("Open a composition and select one layer before running the Cutroom exporter.");
        return;
    }
    if (!comp.selectedLayers || comp.selectedLayers.length !== 1) {
        alert("Select exactly one layer in the active composition.");
        return;
    }
    var layer = comp.selectedLayers[0];
    var data = {
        format: "cutroom-ae-export",
        version: 1,
        exporter: { name: "Cutroom AE Layer Exporter", version: "1.0" },
        composition: {
            name: str(comp.name), width: comp.width, height: comp.height,
            frameRate: comp.frameRate, duration: comp.duration, frameDuration: comp.frameDuration
        },
        layer: {
            name: str(layer.name), index: layer.index,
            inPoint: layer.inPoint, outPoint: layer.outPoint,
            startTime: layer.startTime, stretch: layer.stretch,
            threeDLayer: !!layer.threeDLayer,
            sourceName: (layer.source && layer.source.name) ? str(layer.source.name) : ""
        },
        transform: getTransform(layer),
        effects: getEffects(layer),
        notes: [
            "Effect order follows the After Effects Effect Controls stack.",
            "Keyframe times are normalized to the selected layer in/out range; compTime is also retained.",
            "Expressions and source properties are preserved as metadata, not executed by Cutroom.",
            "Cutroom only renders mapped native approximations; unsupported plug-ins remain listed in the import report."
        ]
    };
    var target = File.saveDialog("Save Cutroom After Effects JSON export", "JSON:*.json");
    if (!target) return;
    if (!/\.json$/i.test(target.name)) target = new File(target.fsName + ".json");
    target.encoding = "UTF-8";
    target.lineFeed = "Unix";
    if (!target.open("w")) {
        alert("Could not write the JSON export: " + target.error);
        return;
    }
    target.write(stringify(data));
    target.close();
    alert("Cutroom JSON export created.\n\nImport this .json file in Cutroom's Presets tab. Check the conversion report for unmapped plug-ins or parameters.");
})();
