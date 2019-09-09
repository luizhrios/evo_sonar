var fs = require("fs")
var inquirer = require('inquirer')
var inquirerFileTreeSelection = require('inquirer-file-tree-selection-prompt')
inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);

classRegex = /^[ |\t]*(?:\w+ ){0,2}class \w+/gm;
methodRegex = /^[ |\t]*(?:\w+ ){0,3}[\w\.]+(?<!new|return) \w+\(.*\)/gm;
linesRegex = /.+/g;

inquirer.prompt({
    type: 'file-tree-selection',
    name: 'src',
    message: "Código fonte (Java)",
    onlyShowDir: true
}).then(answers => {
    let csvData = writeLine('Mês', 'Classes', 'Methods', 'LOC');
    csvData = scanDatasetDir(answers.src, undefined, csvData);
    console.log(csvData)
    fs.writeFileSync("sonar.csv", csvData, 'ascii')
});

function scanDatasetDir(dir, month, csvData) {
    let dirs = fs.readdirSync(dir);
    let currentDir = dir;
    let dirResults;
    if (!month)
        dirs = dirs.sort((a, b) => a - b)
    dirs.forEach(dir => {
        path = `${currentDir}/${dir}`
        if (fs.statSync(path).isDirectory()) {
            month = dir;
            csvData = scanDatasetDir(path, month, csvData)
        }
        else {
            let file = path;
            let results = handleFile(file);
            dirResults = sumResults(dirResults, results);
        }
    })
    if (dirResults) {
        csvData = csvData.concat(writeLine(month, dirResults.classes, dirResults.methods, dirResults.lines));
    }
    return csvData;
}

function writeLine(...strs) {
    return strs.join(",").concat("\n");
}

function handleFile(dir) {
    if (dir.endsWith(".java")) {
        let results = analyzeFile(dir);
        return results;
    }
}

function sumResults(results1, results2) {
    if (results1) {
        results1.classes += results2.classes;
        results1.methods += results2.methods;
        results1.lines += results2.lines;
    } else {
        results1 = results2;
    }
    return results1;
}

function analyzeFile(file) {
    data = fs.readFileSync(file)
    file = data.toString();
    let classesMatches = file.match(classRegex);
    let methodsMatches = file.match(methodRegex);
    let results = {
        classes: classesMatches ? classesMatches.length : 0,
        methods: methodsMatches ? methodsMatches.length : 0,
        lines: file.match(linesRegex).length
    }
    // console.log(`Classes: ${results.classes}`);
    // console.log(`Methods ${results.methods}`);
    // console.log(`Lines: ${results.lines}`);
    return results;
}
