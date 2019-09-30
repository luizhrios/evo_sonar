var fs = require("fs")
var predict = require('predict')
var inquirer = require('inquirer')
var inquirerFileTreeSelection = require('inquirer-file-tree-selection-prompt')
inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);

classRegex = /^[ |\t]*(?:\w+ ){0,2}class \w+/gm;
methodRegex = /^[ |\t]*(?:\w+ ){0,3}[\w\.]+(?<!new|return) \w+\(.*\)/gm;
linesRegex = /.+/g;
methodLinesRegex = /(?<=^([ |\t]*)(?:\w+ ){0,3}[\w\.]+ \w+\(.*\)\s*{[\r\n])(.*[\r\n])+(?=\1})/gm;
classLinesRegex = /(?<=^([ |\t]*)(?:\w+ ){0,2}class \w+.+{[\r\n])(.*[\r\n])+(?=\1})/gm;
innerClassLinesRegex = /(?<=^([ |\t]+)(?:\w+ ){0,2}class \w+.+{[\r\n])(.*[\r\n])+(?=1})/gm;
multiLineComment = /\/\*.+(?:[\r\n].*)+\*\//gm;

inquirer.prompt({
    type: 'file-tree-selection',
    name: 'src',
    message: "Código fonte (Java)",
    onlyShowDir: true
}).then(answers => {
    let allResults = [], csvData;
    allResults = scanDatasetDir(answers.src, undefined, allResults);
    csvData = buildCSV(allResults);
    csvData += predictNextMonth(allResults);
    fs.writeFileSync("sonar.csv", csvData)
});

function scanDatasetDir(path, month, allResults) {
    let pathContent = fs.readdirSync(path);
    let currentPath = path;
    let dirResults;
    if (!month)
        pathContent = pathContent.sort((a, b) => a - b)
    pathContent.forEach(path => {
        fullPath = `${currentPath}/${path}`
        if (fs.statSync(fullPath).isDirectory()) {
            month = path;
            allResults = scanDatasetDir(fullPath, month, allResults);
        }
        else {
            let file = fullPath;
            let results = handleFile(file);
            dirResults = sumResults(dirResults, results);
            dirResults.month = parseInt(month);
        }
    })
    if (dirResults) {
        allResults.push(dirResults);
    }
    return allResults;
}

function buildCSV(allResults) {
    let csvData = writeLine('Mês', 'Classes', 'Methods', 'LOC', 'Classes Deus', 'Métodos Deus');
    allResults.forEach(dirResults => {
        csvData += writeLine(dirResults.month, dirResults.classes, dirResults.methods, dirResults.lines, dirResults.godClasses, dirResults.godMethods);
    })
    return csvData;
}

function writeLine(...strs) {
    console.log(strs);
    return strs.join(",").concat("\n");
}

function handleFile(dir) {
    if (dir.endsWith(".java")) {
        let results = analyzeFile(dir);
        return results;
    }
}

function sumResults(results1, results2) {
    if (results1)
        for (const attr in results1)
            results1[attr] += results2[attr];
    else
        results1 = results2;
    return results1;
}

function analyzeFile(file) {
    file = fs.readFileSync(file).toString();
    file = file.replace(multiLineComment, '');
    let classMatches = file.match(classRegex);
    let methodMatches = file.match(methodRegex);
    let methodLinesMatches = file.match(methodLinesRegex);
    let classLinesMatches = file.match(classLinesRegex);
    let innerClassLinesMatches = file.match(innerClassLinesRegex);
    let godMethods = 0, godClasses = 0;
    godClasses = classLinesMatches.reduce(verifyClassLines, godClasses);
    if (innerClassLinesMatches) {
        godClasses += innerClassLinesMatches.reduce(verifyClassLines, godClasses);
    }
    godMethods += methodLinesMatches.reduce((godMethods, currentMethod) => godMethods += currentMethod.match(/[\r\n]/g).length > 127 ? 1 : 0, godMethods);
    let results = {
        classes: classMatches ? classMatches.length : 0,
        methods: methodMatches ? methodMatches.length : 0,
        lines: file.match(linesRegex).length,
        godClasses,
        godMethods
    }
    return results;
}

function verifyClassLines(godClasses, currentClass) {
    return godClasses += currentClass.match(/.+[\r\n]/g).length > 800 ? 1 : 0;
}

function predictNextMonth(allResults) {
    let attrs = getAttrs(allResults);

    let lrClasses = predict.linearRegression(attrs.allClasses, attrs.months);
    let lrMethods = predict.linearRegression(attrs.allMethods, attrs.months);
    let lrLines = predict.linearRegression(attrs.allLines, attrs.months);
    let lrGodClasses = predict.linearRegression(attrs.allGodClasses, attrs.months);
    let lrGodMethods = predict.linearRegression(attrs.allGodMethods, attrs.months);

    let nextMonth = {
        classes: Math.round(lrClasses.predict(28)),
        methods: Math.round(lrMethods.predict(28)),
        lines: Math.round(lrLines.predict(28)),
        godClasses: Math.round(lrGodClasses.predict(28)),
        godMethods: Math.round(lrGodMethods.predict(28)),
        month: 28
    }

    return writeLine(nextMonth.month, nextMonth.classes, nextMonth.methods, nextMonth.lines, nextMonth.godClasses, nextMonth.godMethods);
}

function getAttrs(allResults) {
    return {
        allClasses: allResults.reduce((classes, currentMonth) => classes.push(currentMonth.classes) && classes, []),
        allMethods: allResults.reduce((methods, currentMonth) => methods.push(currentMonth.methods) && methods, []),
        allLines: allResults.reduce((lines, currentMonth) => lines.push(currentMonth.lines) && lines, []),
        allGodClasses: allResults.reduce((godClasses, currentMonth) => godClasses.push(currentMonth.godClasses) && godClasses, []),
        allGodMethods: allResults.reduce((godMethods, currentMonth) => godMethods.push(currentMonth.godMethods) && godMethods, []),
        months: allResults.reduce((months, currentMonth) => months.push(currentMonth.month) && months, [])
    }
}