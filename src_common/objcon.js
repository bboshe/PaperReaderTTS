export async function connectToObject(channel, objectId) {
    const objDescription = await channel.sendMessage({type: 'object-querry', id:objectId});
    console.log(objectId, objDescription);
    if (!objDescription) return;

    return new Proxy({}, {
        get: (target, prop, receiver) => {
            if (!(prop in objDescription)) 
                return undefined;
            if (objDescription[prop] === "function") {
                return (...args) => channel.sendMessage({type: 'call', id:objectId, prop:prop, args:args});
            } else {
                return channel.sendMessage({type: 'read-property', id:objectId, prop:prop});
            }
        },
        set: (obj, prop, value)  => {
            return channel.sendMessage({type: 'write-property', id:objectId, prop:prop, value:value});
        }
    });
}
    
export class ObjectPublisher {
    constructor(channel, objects, onPropWrite=null) {
        this.channel     = channel;
        this.objects     = objects;
        this.onPropWrite = onPropWrite;
        console.log("publsicherl", objects);
        channel.onMessage.addListener(this.onMessage.bind(this));
    }

    onMessage(data) {
        console.log("onmessage", this.objects, data)
        if (!("id" in data)) return;
        if (!(data.id in this.objects)) return;
        const obj = this.objects[data.id]

        if (data.type === 'object-querry') {
            const keys = [...Object.keys(obj), ...Object.getOwnPropertyNames(obj.__proto__)];
            return Promise.resolve(
                Object.fromEntries(keys
                    .map(k => [k, typeof(obj[k])])
                    .filter(([k, t]) => ["string", "number", "function", "boolean"].includes(t))));
        }
        if (data.type === 'read-property') {
            const value = obj[data.prop];
            if (typeof(value) !== 'function') {
                return Promise.resolve(value);
            } else {
                return Promise.reject(new Error("trying to read function " + structuredClone(data.prop)));
            }
        }
        if (data.type === 'call') {
            return Promise.resolve(obj[data.prop].apply(obj, data.args));
        }
        if (data.type === 'write-property') {
            this.onPropWrite && this.onPropWrite(obj, data.prop, data.value);
            obj[data.prop] = data.value;
            return Promise.resolve();
        }
    }
}

