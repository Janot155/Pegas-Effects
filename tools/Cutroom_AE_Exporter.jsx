/* Pegas / Cutroom After Effects Bridge
   Run from File > Scripts > Run Script File in After Effects.
   Exports the selected layer's complete effect/property tree, static values,
   keyframes, temporal/spatial ease, expressions and transform data to PEG JSON.
   Optional: queues an exact full-composition reference render in AE's own engine.
*/
(function PegasAfterEffectsBridge(){
    var EXPORTER_VERSION = "2.0.0";
    function isArray(v){ return v && v.constructor === Array; }
    function finite(v){ return typeof v === "number" && isFinite(v); }
    function safe(fn, fallback){ try { return fn(); } catch(e) { return fallback; } }
    function plain(v, depth){
        depth = depth || 0;
        if (depth > 12) return { $type:"depth-limit" };
        if (v === null || v === undefined) return null;
        var t = typeof v;
        if (t === "number") return finite(v) ? v : String(v);
        if (t === "string" || t === "boolean") return v;
        if (isArray(v)) {
            var a=[]; for (var i=0;i<v.length;i++) a.push(plain(v[i],depth+1)); return a;
        }
        if (v && v.vertices && v.inTangents && v.outTangents) {
            return {$type:"Shape",vertices:plain(v.vertices,depth+1),inTangents:plain(v.inTangents,depth+1),
                outTangents:plain(v.outTangents,depth+1),closed:!!v.closed};
        }
        if (v && v.text !== undefined && v.font !== undefined) {
            return {$type:"TextDocument",text:String(v.text),font:String(v.font),
                fontSize:safe(function(){return v.fontSize},null),justification:safe(function(){return String(v.justification)},null),
                tracking:safe(function(){return v.tracking},null),leading:safe(function(){return v.leading},null),
                applyFill:safe(function(){return v.applyFill},null),fillColor:plain(safe(function(){return v.fillColor},null),depth+1),
                applyStroke:safe(function(){return v.applyStroke},null),strokeColor:plain(safe(function(){return v.strokeColor},null),depth+1),
                strokeWidth:safe(function(){return v.strokeWidth},null),allCaps:safe(function(){return v.allCaps},null),
                smallCaps:safe(function(){return v.smallCaps},null)};
        }
        if (v && v.fsName) return {$type:"File",path:String(v.fsName),name:String(v.name||"")};
        if (v && v.toString) return {$type:"OpaqueAEValue",display:String(v)};
        return null;
    }
    function interpName(v){
        if (typeof KeyframeInterpolationType !== "undefined") {
            if (v === KeyframeInterpolationType.HOLD) return "hold";
            if (v === KeyframeInterpolationType.BEZIER) return "bezier";
            if (v === KeyframeInterpolationType.LINEAR) return "linear";
        }
        return String(v);
    }
    function easeArray(values){
        var out=[];
        if (!values) return out;
        for (var i=0;i<values.length;i++) out.push({speed:safe((function(x){return function(){return x.speed;};})(values[i]),0),
            influence:safe((function(x){return function(){return x.influence;};})(values[i]),0)});
        return out;
    }
    function spatialTangent(prop, index, method){
        return safe((function(){return prop[method](index);}) , null);
    }
    function readKeys(prop, layer, duration){
        var out=[], count=safe(function(){return prop.numKeys;},0);
        for (var i=1;i<=count;i++){
            var time=safe((function(n){return function(){return prop.keyTime(n);};})(i),0);
            var local=time-layer.inPoint;
            var key={
                sourceIndex:i,time:time,localTime:local,normalizedTime:duration>0?local/duration:0,
                value:plain(safe((function(n){return function(){return prop.keyValue(n);};})(i),null)),
                valueType:String(safe(function(){return prop.propertyValueType;}, "unknown")),
                inInterpolation:interpName(safe((function(n){return function(){return prop.keyInInterpolationType(n);};})(i), "unknown")),
                outInterpolation:interpName(safe((function(n){return function(){return prop.keyOutInterpolationType(n);};})(i), "unknown")),
                inTemporalEase:easeArray(safe((function(n){return function(){return prop.keyInTemporalEase(n);};})(i),[])),
                outTemporalEase:easeArray(safe((function(n){return function(){return prop.keyOutTemporalEase(n);};})(i),[])),
                temporalAutoBezier:!!safe((function(n){return function(){return prop.keyTemporalAutoBezier(n);};})(i),false),
                temporalContinuous:!!safe((function(n){return function(){return prop.keyTemporalContinuous(n);};})(i),false),
                spatialAutoBezier:!!safe((function(n){return function(){return prop.keySpatialAutoBezier(n);};})(i),false),
                spatialContinuous:!!safe((function(n){return function(){return prop.keySpatialContinuous(n);};})(i),false),
                inSpatialTangent:plain(spatialTangent(prop,i,"keyInSpatialTangent")),
                outSpatialTangent:plain(spatialTangent(prop,i,"keyOutSpatialTangent")),
                roving:!!safe((function(n){return function(){return prop.keyRoving(n);};})(i),false),
                selected:!!safe((function(n){return function(){return prop.keySelected(n);};})(i),false)
            };
            key.interpolation = key.inInterpolation===key.outInterpolation?key.inInterpolation:"mixed";
            out.push(key);
        }
        return out;
    }
    function readProperty(prop, layer, duration, depth){
        depth=depth||0;
        var isGroup=safe(function(){return prop.propertyType===PropertyType.INDEXED_GROUP || prop.propertyType===PropertyType.NAMED_GROUP;},false);
        var item={
            nodeType:isGroup?"group":"property",
            name:String(safe(function(){return prop.name;}, "Property")),
            matchName:String(safe(function(){return prop.matchName;}, "")),
            displayName:String(safe(function(){return prop.name;}, "Property")),
            propertyIndex:Number(safe(function(){return prop.propertyIndex;},0)),
            propertyValueType:safe(function(){return prop.propertyValueType;},null),
            propertyValueTypeName:String(safe(function(){return prop.propertyValueType;}, "unknown")),
            valueType:"unknown",value:null,defaultValue:null,
            canVaryOverTime:!!safe(function(){return prop.canVaryOverTime;},false),
            enabled:!!safe(function(){return prop.enabled;},true),
            expression:String(safe(function(){return prop.expression;}, "")),
            expressionEnabled:!!safe(function(){return prop.expressionEnabled;},false),
            expressionError:String(safe(function(){return prop.expressionError;}, "")),
            dimensionsSeparated:!!safe(function(){return prop.dimensionsSeparated;},false),
            isSeparationLeader:!!safe(function(){return prop.isSeparationLeader;},false),
            isSeparationFollower:!!safe(function(){return prop.isSeparationFollower;},false),
            dimensions:Number(safe(function(){return prop.value.length;},0)),
            isSpatial:!!safe(function(){return prop.isSpatial;},false),
            hasMin:!!safe(function(){return prop.hasMin;},false),
            minValue:plain(safe(function(){return prop.minValue;},null)),
            hasMax:!!safe(function(){return prop.hasMax;},false),
            maxValue:plain(safe(function(){return prop.maxValue;},null)),
            keys:[],children:[],source:{}
        };
        if (isGroup && depth < 18){
            var n=safe(function(){return prop.numProperties;},0);
            for(var i=1;i<=n;i++){
                var child=safe((function(index){return function(){return prop.property(index);};})(i),null);
                if(child) item.children.push(readProperty(child,layer,duration,depth+1));
            }
        } else {
            var value=safe(function(){return prop.value;},null);
            item.value=plain(value);item.valueType=value===null?"unknown":(isArray(value)?"vector":typeof value);
            item.keys=readKeys(prop,layer,duration);
        }
        return item;
    }
    function getTransform(layer, duration){
        var group=safe(function(){return layer.property("ADBE Transform Group");},null);
        if(!group) return {};
        var aliases={position:"ADBE Position",anchorPoint:"ADBE Anchor Point",scale:"ADBE Scale",rotation:"ADBE Rotate Z",opacity:"ADBE Opacity"};
        var out={};
        for(var name in aliases) if(aliases.hasOwnProperty(name)){
            var p=safe((function(n){return function(){return group.property(n);};})(aliases[name]),null);
            if(p) out[name]=readProperty(p,layer,duration,0);
        }
        return out;
    }
    function getEffects(layer, duration){
        var parade=safe(function(){return layer.property("ADBE Effect Parade");},null),out=[];
        if(!parade)return out;
        var count=safe(function(){return parade.numProperties;},0);
        for(var i=1;i<=count;i++){
            var effect=safe((function(n){return function(){return parade.property(n);};})(i),null);
            if(!effect)continue;
            var item={sourceIndex:i-1,name:String(safe(function(){return effect.name;},"Effect")),
                matchName:String(safe(function(){return effect.matchName;},"")),enabled:!!safe(function(){return effect.enabled;},true),
                active:!!safe(function(){return effect.active;},true),properties:[],source:{}};
            var total=safe(function(){return effect.numProperties;},0);
            for(var j=1;j<=total;j++){
                var p=safe((function(n){return function(){return effect.property(n);};})(j),null);
                if(p)item.properties.push(readProperty(p,layer,duration,0));
            }
            out.push(item);
        }
        return out;
    }
    function writeJSON(file, data){
        file.encoding="UTF-8";
        if(!file.open("w"))throw new Error("Could not open output file: "+file.error);
        try{file.write(JSON.stringify(data,null,2));}finally{file.close();}
    }
    function exportLayer(comp,layer,file){
        var duration=Math.max(0.000001,layer.outPoint-layer.inPoint);
        var source={
            application:"Adobe After Effects",applicationVersion:String(app.version||"unknown"),
            exporter:"Pegas AE Bridge",exporterVersion:EXPORTER_VERSION,projectName:String(app.project.file?app.project.file.name:"Unsaved project")
        };
        var transform=getTransform(layer,duration);
        var data={
            format:"cutroom-ae-export",schemaVersion:2,
            source:source,
            composition:{name:String(comp.name),width:comp.width,height:comp.height,frameRate:comp.frameRate,
                duration:comp.duration,pixelAspect:comp.pixelAspect,displayStartTime:comp.displayStartTime,
                displayStartFrame:comp.displayStartFrame},
            layer:{name:String(layer.name),index:layer.index,id:safe(function(){return layer.id;},null),
                inPoint:layer.inPoint,outPoint:layer.outPoint,duration:duration,startTime:layer.startTime,
                stretch:layer.stretch,threeDLayer:!!layer.threeDLayer,enabled:!!layer.enabled,
                adjustmentLayer:!!layer.adjustmentLayer,hasTrackMatte:!!safe(function(){return layer.hasTrackMatte;},false),
                parentName:layer.parent?String(layer.parent.name):null},
            transform:transform,effects:getEffects(layer,duration),
            exportInfo:{timeUnit:"seconds",keyframeLocalOrigin:"selected-layer-inPoint",
                keyframeNormalizedTime:"(keyTime - layer.inPoint) / (layer.outPoint - layer.inPoint)",
                allOriginalMatchNames:true,allPropertyTrees:true,expressionsPreservedAsText:true}
        };
        writeJSON(file,data);return data;
    }
    function queueCompositionRender(comp, file){
        var item=app.project.renderQueue.items.add(comp);
        var output=item.outputModule(1);
        output.file=file;
        item.render=true;
        return item;
    }
    var comp=app.project&&app.project.activeItem;
    if(!(comp instanceof CompItem)){alert("Open a composition and select exactly one layer first.");return;}
    if(comp.selectedLayers.length!==1){alert("Select exactly one layer that already has the FFX preset applied, then run this script again.");return;}
    var layer=comp.selectedLayers[0];
    var dlg=new Window("dialog","Pegas After Effects Bridge");
    dlg.orientation="column";dlg.alignChildren="fill";
    dlg.add("statictext",undefined,"Export the selected layer's effect stack, values, keyframes, expressions and transform data.");
    dlg.add("statictext",undefined,"The JSON is an interchange source. Native Pegas mappings may be approximations.");
    var queue=dlg.add("checkbox",undefined,"Also queue an exact full-composition reference render in After Effects");
    queue.value=true;
    dlg.add("statictext",undefined,"The reference render is flattened and uses Adobe's own installed effects/plugins.");
    var buttons=dlg.add("group");buttons.alignment="right";
    var cancel=buttons.add("button",undefined,"Cancel",{name:"cancel"});
    var run=buttons.add("button",undefined,"Export PEG JSON",{name:"ok"});
    cancel.onClick=function(){dlg.close(0);};
    run.onClick=function(){
        try{
            var f=File.saveDialog("Save Pegas After Effects export","PEG JSON:*.json");
            if(!f){dlg.close(0);return;}
            if(!/\.json$/i.test(f.name))f=new File(f.fsName+".json");
            var result=exportLayer(comp,layer,f),msg="PEG JSON exported.\nEffects: "+result.effects.length+"\nComposition: "+result.composition.name;
            if(queue.value){
                var rf=File.saveDialog("Choose a filename for the exact AE composition render","Video:*");
                if(rf){
                    queueCompositionRender(comp,rf);
                    msg+="\n\nAn exact composition render was added to the AE Render Queue. Select the queued item and press Render in After Effects.";
                }
            }
            alert(msg);dlg.close(1);
        }catch(e){alert("Pegas AE Bridge failed:\n"+e.toString());}
    };
    dlg.center();dlg.show();
})();