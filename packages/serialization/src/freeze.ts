import { Project, ts } from 'ts-morph'
import { relative } from 'path'

const cwd = process.cwd()
const tsConfigFilePath = `${cwd}/tsconfig.json`

const project = new Project({
    tsConfigFilePath,
})

const decoratorfile = project.getSourceFile(__dirname + '/freeze.decorator.d.ts')

if (!decoratorfile) {
    throw new Error('The @Freeze decorator is not used in the project.')
}

const references = decoratorfile.getFunction('Freeze')?.findReferences()

if (!references) {
    throw new Error('The @Freeze decorator is imported, but not used in the project.')
}

for (const ref of references) {
    for (const refref of ref.getReferences()) {
        const decorator = refref.getNode().getParent()?.getParent()?.asKind(ts.SyntaxKind.Decorator)
        if (!decorator) continue;

        const rpath = relative(cwd, decorator.getSourceFile().getFilePath())

        const classDeclaration = decorator.getParentIfKind(ts.SyntaxKind.ClassDeclaration);
        if (!classDeclaration) continue;

        const versionProperty = classDeclaration.getType().getProperty('version')
        if (!versionProperty) {
            console.log(`${rpath}: No version property found on ${classDeclaration.getName()}`)
            continue
        }

        const typeParameter = decorator.getTypeArguments()[0]
        if (typeParameter) {
            console.log(`${rpath} - ${classDeclaration.getName()}: Already frozen with <${typeParameter.getText()}>`)
            continue;
        }

        const version = project.getTypeChecker().getTypeOfSymbolAtLocation(versionProperty, classDeclaration).getText()

        console.log(`${rpath} - ${classDeclaration.getName()}: Freezing with version ${version}`)

        const serializeProperty = classDeclaration.getType().getProperty('serialize')
        if (!serializeProperty) {
            console.log(`${rpath} - ${classDeclaration.getName()}: No serialize property`)
            continue
        }

        const serializeMethod = project.getTypeChecker().getTypeOfSymbolAtLocation(serializeProperty, classDeclaration).getCallSignatures()[0]
        const serialized = serializeMethod.getReturnType().getText()
        const name = serializeMethod.getParameters()[0].getTypeAtLocation(classDeclaration).getSymbol()?.getName()
        if (!name) {
            console.log(`${rpath} - ${classDeclaration.getName()}: Cannot find name of serialized type`)
            continue
        }

        const serializedName = name + 'Serialized' + version
        const serializedFilename = name + '.serialized.' + version


        const file = refref.getSourceFile().getDirectory().createSourceFile(serializedFilename + '.ts')


        file.addTypeAlias({
            name: serializedName,
            type: serialized,
            isExported: true,
        })

        decorator.getSourceFile().addImportDeclaration({
            moduleSpecifier: './' + serializedFilename,
            namedImports: [serializedName],
        })

        decorator.addTypeArgument(serializedName)


        project.saveSync()
    }
}