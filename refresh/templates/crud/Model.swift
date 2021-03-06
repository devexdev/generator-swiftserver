import SwiftyJSON

public struct {{model.classname}} {
    {{#each propertyInfos}}
    public let {{name}}: {{swiftType}}
    {{/each}}

    public init({{#each propertyInfos}}{{#if @last}}{{name}}: {{swiftType}}{{else}}{{name}}: {{swiftType}}, {{/if}}{{/each}}) {
        {{#each propertyInfos}}
        self.{{name}} = {{name}}
        {{/each}}
    }

    public init(json: JSON) throws {
        // Required properties
        {{#each infoFilter}}
        guard json["{{name}}"].exists() else {
            throw ModelError.requiredPropertyMissing(name: "{{name}}")
        }
        guard let {{name}} = json["{{name}}"].{{swiftyJSONType}} else {
            throw ModelError.propertyTypeMismatch(name: "{{name}}", type: "{{jsType}}", value: json["{{name}}"].description, valueType: String(describing: json["{{name}}"].type))
        }

        {{#ifCond jsType '===' 'number'}}
        self.{{name}} = Double({{name}})
            {{else}}
        self.{{name}} = {{name}}
            {{/ifCond}}
        {{/each}}

        {{#each noInfoFilter}}
        if json["{{name}}"].exists() &&
           json["{{name}}"].type != .{{swiftyJSONType}} {
            throw ModelError.propertyTypeMismatch(name: "{{name}}", type: "{{jsType}}", value: json["{{info.name}}"].description, valueType: String(describing: json["{{name}}"].type))
        }

        {{#ifCond jsType '===' 'number'}}
          self.{{name}} = json["{{name}}"].number.map { Double($0) }{{defaultValueClause}}
        {{else}}
          self.{{name}} = json["{{name}}"].{{swiftyJSONProperty}}{{defaultValueClause}}
        }
        {{/ifCond}}
        {{/each}}

        // Check for extraneous properties
        if let jsonProperties = json.dictionary?.keys {
            let properties: [String] = [{{#each propertyInfos}}{{#if @last}}{{name}}{{else}}{{name}}, {{/if}}{{/each}}]
            for jsonPropertyName in jsonProperties {
                if !properties.contains(where: { $0 == jsonPropertyName }) {
                    throw ModelError.extraneousProperty(name: jsonPropertyName)
                }
            }
        }
    }

    public func settingID(_ newId: String?) -> {{model.classname}} {
      {{#settingID propertyInfos model}}
      {{/settingID}}
    }

    public func updatingWith(json: JSON) throws -> {{model.classname}} {
        {{#each propertyInfos}}
        if json["{{name}}"].exists() &&
           json["{{name}}"].type != .{{swiftyJSONType}} {
            throw ModelError.propertyTypeMismatch(name: "{{name}}", type: "{{jsType}}", value: json["{{name}}"].description, valueType: String(describing: json["{{name}}"].type))
        }
            {{#ifCond jsType '===' 'number'}}
        let {{name}} = json["{{name}}"].number.map { Double($0) } ?? self.{{name}}
            {{else}}
        let {{name}} = json["{{name}}"].{{swiftyJSONProperty}} ?? self.{{name}}
            {{/ifCond}}

        {{/each}}
        return {{model.classname}}({{#each propertyInfos}}{{#if @last}}{{name}}: {{name}}{{else}}{{name}}: {{name}}, {{/if}}{{/each}})
    }

    public func toJSON() -> JSON {
        var result = JSON([:])
        {{#each noInfoFilter}}
        result["{{name}}"] = JSON({{name}})
        {{/each}}
        {{#each infoFilter}}
        if let {{name}} = {{name}} {
            result["{{name}}"] = JSON({{name}})
        }
        {{/each}}

        return result
    }
}
