/// <reference path="./commons.ts"/>

/* @internal */
namespace ts.reflection {

    /**
     * Entry point for type serialization. Chooses the right serialization for the given type, using
     * the TypeFlags.
     */
    export function writeType(type: Type, checker: TypeChecker, typeCounter: Counter, writer: Writer): Type[] {
        writer.write(`${tempTypeVar} = ${localTypeVar}[${type.$info.localIndex}];`).writeLine();
        const discoveredTypes: Type[] = [];
        const members = type.symbol ? valuesOf<Symbol>(type.symbol.members) : [];

        switch (type.flags & allTypeFlagsMask) {
            case TypeFlags.StringLiteral:
                debug.warn('Detected string literal type. Not supported yet.');
                break;
            case TypeFlags.TypeParameter:
                writeTypeParameter();
                break;
            case TypeFlags.Union:  // let x: T | U;
                writeUnionType();
                break;
            case TypeFlags.Intersection: // let x: T & U;
                writeIntersectionType();
                break;
            case TypeFlags.Never:
                debug.warn('Detected never type. Not supported yet.');
                break;

            case TypeFlags.Object:
                writeObjectType();
                break;

            default:
                let name = type.symbol ? type.symbol.name : 'unknown';
                debug.warn('exploreType found an unknown type:', name, 'with typeFlags:', type.flags);
        }

        return discoveredTypes;


        function writeObjectType() {
            let objectType = <ObjectType>type;
            switch (objectType.objectFlags) {
                case ObjectFlags.Class:
                case ObjectFlags.Reference | ObjectFlags.Class:
                    writeClassType();
                    break;
                case ObjectFlags.Interface:
                case ObjectFlags.Reference | ObjectFlags.Interface:
                    writeInterfaceType();
                    break;
                case ObjectFlags.Reference:
                    writeTypeReference();
                    break;
                case ObjectFlags.Tuple: // let x: [string, number];
                case ObjectFlags.Reference | ObjectFlags.Tuple:
                    debug.warn('Detected tuple type. Not supported yet.');
                    break;
                case ObjectFlags.Anonymous:
                    writeAnonymousType();
                    break;
            }
        }


        /**
         * Class type serialization. Uses writeTypeDetails(), in common with interfaces.
         * Writes serialization kind, implements and extends clause, static properties and methods.
         */
        function writeClassType() {
            writeTypeKind(SerializedTypeKind.Class);
            writeTypeDetails();
            writeHeritageClauseElements('implements', getClassImplementsNodes);
            writeClassExtends();
            writeStaticMembers();
        }

        /**
         * Interface type serialization. Uses writeTypeDetails(), in common with classes.
         * Writes serialization kind and extends clause
         */
        function writeInterfaceType() {
            writeTypeKind(SerializedTypeKind.Interface);
            writeTypeDetails();
            writeHeritageClauseElements('extends', getInterfaceBaseTypeNodes);
        }

        /**
         * Writes all class/interface type details: name, type parameters, properties,
         * methods, constructors, call signatures, index signatures.
         */
        function writeTypeDetails() {
            writeTypeName();
            writeTypeParameters();
            writeMembers();
            writeConstructors();
            writeCallSignatures();
            writeIndexSignatures();
        }

        /**
         * Writes properties and methods.
         */
        function writeMembers() {
            let filteredMembers = members.filter(symbol =>
                (symbol.flags & SymbolFlags.Property) || (symbol.flags & SymbolFlags.Method));
            if (filteredMembers.length > 0) {
                writeTypeProperty('members').write(' = ').writeArrayStart();
                for (let symbol of filteredMembers) {
                    writeMemberSymbol(symbol);
                }
                writer.writeArrayEnd().write(';').writeLine();
            }
        }

        /**
         * Writes static properties and methods.
         */
        function writeStaticMembers() {
            if (type.symbol.declarations && type.symbol.declarations.length > 0) {
                let declaration = <ClassLikeDeclaration>type.symbol.declarations[0];
                let statics = declaration.members.filter(member => getModifierFlags(member) & ModifierFlags.Static);
                if (statics.length > 0) {
                    writeTypeProperty('statics').write(' = ').writeArrayStart();
                    for (let member of statics) {
                        let symbol = checker.getSymbolAtLocation(member.name);
                        writeMemberSymbol(symbol);
                    }
                    writer.writeArrayEnd().write(';').writeLine();
                }
            }
        }

        function writeMemberSymbol(symbol: Symbol) {
            writer.writeObjectStart()
                .write(`name: '${symbol.name}',`).writeLine()
                .write('type: ')
            if (symbol.flags & SymbolFlags.Property) {
                writeReferenceToTypeForNode(symbol.valueDeclaration).write(',').writeLine();
            } else if (symbol.flags & SymbolFlags.Method) {
                writeMethodMember(symbol).write(',').writeLine();
            }
            if (symbol.flags & SymbolFlags.Optional) {
                writer.write('optional: true,').writeLine();
            }
            writer.writeObjectEnd().write(`,`).writeLine();
        }

        /**
         * Writes constructors.
         */
        function writeConstructors() {
            let filteredMembers = members.filter(symbol => symbol.flags === SymbolFlags.Constructor || (
                symbol.flags === SymbolFlags.Signature &&
                (symbol.declarations[0].kind === SyntaxKind.ConstructSignature ||
                    symbol.declarations[0].kind === SyntaxKind.ConstructorType)
            ));
            if (filteredMembers.length > 0) {
                writeTypeProperty('construct').write(' = ').writeArrayStart();
                writeSignatures(filteredMembers);
                writer.writeArrayEnd().write(';').writeLine();
            }
        }

        /**
         * Writes call signatures.
         */
        function writeCallSignatures() {
            let filteredMembers = members.filter(symbol =>
                (symbol.flags & SymbolFlags.Signature) &&
                (symbol.declarations[0].kind === SyntaxKind.CallSignature ||
                    symbol.declarations[0].kind === SyntaxKind.FunctionType));
            if (filteredMembers.length > 0) {
                writeTypeProperty('call').write(' = ').writeArrayStart();
                writeSignatures(filteredMembers);
                writer.writeArrayEnd().write(';').writeLine();
            }
        }

        /**
         * Writes index signatures.
         */
        function writeIndexSignatures() {
            let filteredMembers = members.filter(symbol =>
                (symbol.flags & SymbolFlags.Signature) &&
                symbol.declarations[0].kind === SyntaxKind.IndexSignature);
            if (filteredMembers.length > 0) {
                writeTypeProperty('index').write(' = ').writeArrayStart();
                writeSignatures(filteredMembers);
                writer.writeArrayEnd().write(';').writeLine();
            }
        }

        /**
         * Writes references to type parameters.
         */
        function writeTypeParameters() {
            let filteredMembers = members.filter(symbol => symbol.flags & SymbolFlags.TypeParameter);
            if (filteredMembers.length > 0) {
                writeTypeProperty('typeParameters').write(' = ').writeArrayStart(true);
                for (let symbol of filteredMembers) {
                    writeReferenceToTypeForNode(symbol.declarations[0]).write(`, `);
                }
                writer.writeArrayEnd(true).write(';').writeLine();
            }
        }

        /**
         * Writes a type parameter, that can referenced by other types
         */
        function writeTypeParameter() {
            let typeParam = <TypeParameter>type;
            writeTypeName();
            writeTypeKind(SerializedTypeKind.Parameter);
            if (typeParam.symbol.declarations) {
                let declaration = <TypeParameterDeclaration>typeParam.symbol.declarations[0];
                if (declaration.constraint) {
                    writeTypeProperty('constraint').write(` = `);
                    writeReferenceToTypeForNode(declaration.constraint).write(';').writeLine();
                }
            }
        }


        /**
         * Writes a reference to the variable that holds metadata for the type of the given node.
         */
        function writeReferenceToTypeForNode(node: Node) {
            return writeReferenceToType(checker.getTypeAtLocation(node));
        }

        /**
         * Writes a method of a class/interface.
         */
        function writeMethodMember(symbol: Symbol) {
            writer.writeObjectStart();
            writer.write(`kind: 'function',`).writeLine()
                .write(`name: '${symbol.name}', `).writeLine()
                .write(`signatures: `).writeArrayStart();
            writeSignatures([symbol]);
            return writer.writeArrayEnd().writeObjectEnd();
        }

        /**
         * Writes signatures.
         */
        function writeSignatures(symbols: Symbol[]) {
            let declarations: FunctionLikeDeclaration[];
            let signature: Signature;
            for (let symbol of symbols) {
                declarations = <FunctionLikeDeclaration[]>symbol.declarations;
                for (let declaration of declarations) {
                    signature = checker.getSignatureFromDeclaration(declaration);
                    writeSignature(signature, declaration);
                    writer.write(',').writeLine();
                }
            }
        }

        /**
         * Writes signature details.
         */
        function writeSignature(signature: Signature, declaration: FunctionLikeDeclaration) {
            writer.writeObjectStart();
            let hasRestParam = declaration.parameters.length > 0 &&
                declaration.parameters[declaration.parameters.length - 1].dotDotDotToken;
            let length = hasRestParam ? declaration.parameters.length - 1 : declaration.parameters.length;
            let returnType = checker.getReturnTypeOfSignature(signature);
            writer.write(`length: ${length},`).writeLine()
                .write(`parameters: `).writeArrayStart(!declaration.parameters.length);
            for (let parameter of declaration.parameters) {
                writer.writeObjectStart(true)
                    .write(`name: '${(<Identifier>parameter.name).text}', type: `) //TODO: check this! name can be Identifier or BindingPattern (what is BindingPattern?)
                writeReferenceToTypeForNode(parameter)
                    .writeObjectEnd(true).write(',').writeLine();
            }
            writer.writeArrayEnd(!declaration.parameters.length).write(',').writeLine();

            if (signature.typeParameters && signature.typeParameters.length > 0) {
                writer.write(`typeParameters: `).writeArrayStart(true);
                for (let parameter of signature.typeParameters) {
                    writeReferenceToType(parameter).write(', ');
                }
                writer.writeArrayEnd(true).write(',').writeLine();
            }
            if (returnType) {
                writer.write(`returns: `);
                writeReferenceToType(returnType).write(', ').writeLine();
            }
            if (hasRestParam) {
                writer.write(`rest: true`).writeLine();
            }
            writer.writeObjectEnd();
        }

        /**
         * Writes class extends clause.
         */
        function writeClassExtends() {
            let baseClass = getClassExtendsHeritageClause();
            if (baseClass) {
                writeTypeProperty('extends').write(` = `);
                writeReferenceToTypeForNode(baseClass).write(';').writeLine();
            }
        }

        /**
         * Utility function shared by class implements clause writer and interface extends clause writer.
         */
        function writeHeritageClauseElements(propertyName: string, heritageClauseFilter: (d: ClassLikeDeclaration | InterfaceDeclaration) => NodeArray<TypeNode>) {
            const heritageClausesTypes = getHeritageClauses(type, heritageClauseFilter);
            if (heritageClausesTypes && heritageClausesTypes.length > 0) {
                writeTypeProperty(propertyName).write(` = [`);
                for (let clause of heritageClausesTypes) {
                    writeReferenceToType(clause).write(', ');
                }
                writer.write(`];`).writeLine();
            }
        }


        function writeTypeName(): Writer {
            return writeTypeProperty('name').write(` = '${type.$info.name}';`).writeLine();
        }

        function writeTypeKind(kind: string): Writer {
            return writeTypeProperty('kind').write(` = '${kind}';`).writeLine();
        }

        function writeTypeProperty(propertyName: string): Writer {
            return writer.write(`${tempTypeVar}.${propertyName}`);
        }

        function getHeritageClauses(type: Type, searchFn: (d: InterfaceDeclaration) => TypeNode[]): Type[] {
            let clauses: Type[] = [];
            let set: any = {};
            let searchResults: TypeNode[];
            for (let declaration of type.symbol.declarations) {
                searchResults = searchFn(<InterfaceDeclaration>declaration);
                if (searchResults && searchResults.length > 0) {
                    for (let result of searchResults) {
                        if (!set[result.id]) {
                            set[result.id] = true;
                            clauses.push(checker.getTypeAtLocation(result));
                        }
                    }
                }
            }
            return clauses;
        }

        function getClassImplementsNodes(declaration: ClassLikeDeclaration) {
            let result = getClassImplementsHeritageClauseElements(declaration) || <NodeArray<TypeNode>>[];

            //When an interface with the same name of a class extends one (or more) base interface(s),
            //these are included as extends heritage clauses.
            var tmp: NodeArray<TypeNode>;
            for (let declaration of type.symbol.declarations) {
                tmp = getInterfaceBaseTypeNodes(<InterfaceDeclaration>declaration);
                if (tmp) {
                    result = <NodeArray<TypeNode>>result.concat(tmp);
                }
            }
            return result.length > 0 ? result : null;
        }

        function getClassExtendsHeritageClause(): TypeNode {
            let result: TypeNode;
            for (let declaration of type.symbol.declarations) {
                result = getClassExtendsHeritageClauseElement(<ClassLikeDeclaration>declaration);
                if (result) {
                    return (<ObjectType>checker.getTypeAtLocation(result)).objectFlags & ObjectFlags.Class ? result : null;
                }
            }
            return null;
        }

        function writeTypeReference() {
            let ref = <TypeReference>type;
            if (isArrayType(type)) { //why this distinction? array should be nothing special... TBD
                writeTypeKind(SerializedTypeKind.Array);
                writeTypeProperty('elementType').write(' = ');
                writeReferenceToType(ref.typeArguments[0]).write(';').writeLine();
            } else {
                writeTypeKind(SerializedTypeKind.Reference);
                writeTypeProperty('type').write(' = ');
                writeReferenceToType(ref.target).write(';').writeLine();
                if (ref.typeArguments) {
                    writeTypeProperty(`typeParameters`).write(' = ').writeArrayStart(true);
                    for (let argument of ref.typeArguments) {
                        writeReferenceToType(argument).write(', ');
                    }
                    writer.writeArrayEnd(true).write(';').writeLine();
                }
            }
        }

        function writeUnionType() {
            writeTypeKind(SerializedTypeKind.Union);
            writeUnionOrIntersectionTypes();
        }

        function writeIntersectionType() {
            writeTypeKind(SerializedTypeKind.Intersection);
            writeUnionOrIntersectionTypes();
        }

        function writeUnionOrIntersectionTypes() {
            let unionOrIntersection = <UnionOrIntersectionType>type;
            writeTypeProperty('types').write(' = ').writeArrayStart(true);
            for(let type of unionOrIntersection.types) {
                writeReferenceToType(type).write(', ');
            }
            writer.writeArrayEnd(true).write(';').writeLine();
        }

        function writeAnonymousType() {
            switch (type.symbol.flags) { //TODO: filter with bitmask
                case ts.SymbolFlags.ObjectLiteral:
                    debug.warn('Detected object literal type. Not supported yet.');
                    //todo;
                    break;
                case ts.SymbolFlags.Class:
                    writeClassExpression();
                    break;
                case ts.SymbolFlags.TypeLiteral:
                    writeTypeLiteral();
                    break;
                default:
                    debug.warn('Unknown anonymous type with symbolFlags:', type.symbol.flags);
            }
        }

        function writeTypeLiteral() {
            writeTypeKind(SerializedTypeKind.Alias);
            writeTypeName();
            writeConstructors();
            writeMembers();
            writeCallSignatures();
            writeIndexSignatures();
        }

        function writeClassExpression() {
            writeTypeKind(SerializedTypeKind.ClassExpression);
            writeTypeProperty('type').write(' = ');
            let targetType = checker.getDeclaredTypeOfSymbol(type.symbol);
            writeReferenceToType(targetType).write(';').writeLine();
        }

        function writeReferenceToType(type: Type): Writer {
            let intrinsicType = getIntrinsicType(type.flags);
            if (intrinsicType) {
                return writer.write(intrinsicType.varName);
            }
            if (!type.$info) {
                //first time we see this node. Enqueue it for later inspection.
                addReflectionInfo(type, typeCounter);
                discoveredTypes.push(type);
            }
            return writer.write(`${localTypeVar}[${type.$info.localIndex}]`)
        }

    }

    function isArrayType(type: ts.Type) {
        let ref = <TypeReference>type;
        return ref.target &&
            ref.target.symbol &&
            ref.target.symbol.name === 'Array' &&
            ref.target.typeParameters &&
            ref.target.typeParameters.length === 1;
    }



}
