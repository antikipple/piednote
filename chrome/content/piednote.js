var pnStartDelimiter = '[';
var pnEndDelimiter = ']';
var pnLiRegexpToken = '\\w+';
var pnLiArray = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];
var pnUrlPattern = /http:\/\/[^ ]+[\w\/]/;
var pnNumberPattern = new RegExp('\\' + pnStartDelimiter + '(' + pnLiRegexpToken + ')' + '\\' + pnEndDelimiter);
var pnFootnotePattern = new RegExp('^\\s*' + pnNumberPattern.source + '\\s*' + '(' + pnUrlPattern.source + ')' + '\\s*$');
var pnSpecialKeys = ['footnoteLocation', 'parentNode'];

function dictSize(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

function dictDump(dict) {
    var temp = "\n";
    for (var key in dict) {
        temp += '{' + key + ' > ' + dict[key] + '}\n';
    }
    return temp;
};

var piednote = {

    createFootnotes : function() {
        var editor = GetCurrentEditor();
        var editorType = GetCurrentEditorType();
        var nodes = editor.rootElement.childNodes;

        //alert(pnNumberPattern + ':' + pnFootnotePattern);
        var i = 0;
        var urlDict = {};
        editor.beginTransaction()
        urlDict = piednote.findExistingFootnotes(editor, nodes, urlDict);
        urlDict = piednote.parseText(editor, nodes, urlDict);
        //alert(dictDump(urlDict));
        piednote.dumpFootnotes(editor, urlDict, editorType);
        editor.endTransaction();
    },
    
    //FIX: Footnotes in bottom post fail
    //TODO: Handle deleting a footnote
    //TODO: Handle renumbering footnotes automatically.
    //TODO: Handle HTML editor
    findExistingFootnotes : function(editor, nodes, urlDict) {
        var node;
        var footnoteMatch;
        var nodesToDelete = [];
    
        for (var i = 0; i < nodes.length; i++) {
            node = nodes[i];
            
            if (node.hasChildNodes()) {
                urlDict = piednote.findExistingFootnotes(editor, node.childNodes, urlDict);
            }
            else {
                try {
                    //TODO: Make a dictionary and dump all footnotes at the end
                    footnoteMatch = pnFootnotePattern.exec(node.nodeValue.toString());
                    var j = i;
                    while(footnoteMatch && j < nodes.length) {
                        //alert(node.nodeName + ':' + node.nodeValue.toString() + ':' + footnoteMatch);
                        //http://saladwithsteve.com/2008/02/javascript-undefined-vs-null.html
                        if (!urlDict['parentNode']) {
                            urlDict['footnoteLocation'] = i;
                            urlDict['parentNode'] = node.parentNode;
                        }
                        urlDict[footnoteMatch[2]] = footnoteMatch[1];
                        var tmpSibling = node.nextSibling;
                        nodesToDelete.push(node);
                        if (tmpSibling && tmpSibling.nodeName == "BR") {
                           nodesToDelete.push(tmpSibling);
                        }
                        node = nodes[++j];
                        footnoteMatch = pnFootnotePattern.exec(node.nodeValue.toString());
                    }
                }
                catch (e) 
                {
                    //alert(e);
                }
            }
        }
        var n = nodesToDelete.length;
        for (var i = 0; i < n; i++) {
            editor.deleteNode(nodesToDelete[i]);
        }
        if (!urlDict['parentNode']) {
            urlDict['footnoteLocation'] = nodes.length;
            urlDict['parentNode'] = editor.rootElement;
        }
        return urlDict;
    },
    
    //TODO: Undo functionality only works for footnotes but won't undo replaced links 
    //TODO: Options: numeric / alphabetic, brackets / braces / parantheses / point
    //TODO: Menu item
    //TODO: Description
    //TODO: Account for modifying options in the middle of editing
    //https://developer.mozilla.org/en/NsIEditor
    //http://xulplanet.mozdev.org/references/xpcomref/nsIPlaintextEditor.html
    //Daca nu exista footnotes sa le faca unde e cursorul sau la sfarsit?
    parseText : function(editor, nodes, urlDict) {
        var node;
        var numFootnotes = dictSize(urlDict) - pnSpecialKeys.length; //FIX: A more elegant way to avoid the predefined nodes
        var urlMatch;
        var n = nodes.length;
    
        for (var i = 0; i < n; i++) {
            node = nodes[i];
            
            if (node.hasChildNodes()) {
                urlDict = piednote.parseText(editor, node.childNodes, urlDict);
            }
            else {
                try {
                    urlMatch = pnUrlPattern.exec(node.nodeValue.toString());
                    while(urlMatch.length) {
                        //alert(node.nodeName + ':' + node.nodeValue.toString() + ':' + urlMatch);
                        var tmpLi;
                        if (urlMatch[0] in urlDict) {
                            //alert('Found key: ' + urlMatch[0] + ' > ' + urlDict[urlMatch[0]]);
                            tmpLi = urlDict[urlMatch[0]];
                        }
                        else {
                            //alert('Key not found: ' + urlMatch[0]);
                            tmpLi = pnLiArray[numFootnotes++];
                            urlDict[urlMatch[0]] = tmpLi;
                        }
                        var tmpFootno = pnStartDelimiter + tmpLi + pnEndDelimiter;
                        node.nodeValue = node.nodeValue.replace(pnUrlPattern, tmpFootno);
                        urlMatch = pnUrlPattern.exec(node.nodeValue.toString());
                    }
                }
                catch (e) 
                {
                    //alert(e);
                }
            }
        }
        return urlDict;
    },
    
    //TODO: Handle HTML editor
    dumpFootnotes : function(editor, urlDict, editorType) {
        var parentNode = urlDict.parentNode;
        var footnoteLocation = urlDict.footnoteLocation;
        var nodes = editor.rootElement.childNodes;
        //http://wolfram.kriesing.de/blog/index.php/2008/javascript-sort-object-by-a-value
        //Sort the list of links inverted so they will show up correctly when inserted
        var sorted = [];
        for (var key in urlDict) {
            sorted.push([key, urlDict[key]]);
            sorted.sort(function (a, b) {return b[1] - a[1]});
        }
        if (footnoteLocation == nodes.length) {
            //We're at the end, let's insert a line
            editor.endOfDocument();
            editor.insertLineBreak();
        }
        for (var i = 0; i < sorted.length; i++) {
            var key = sorted[i][0];
            var value = sorted[i][1];
            try {
                if( editorType == 'textmail' || editorType == 'text' )
                {  
                    if (pnSpecialKeys.indexOf(key) != -1) {
                        continue;
                    }
                    //var node = urlDict['footnoteNode'].cloneNode(false);
                    //var node = editor.createNode('#text', parentNode, footnoteLocation);
                    var tmpFootno = pnStartDelimiter + value + pnEndDelimiter;
                    //alert('about to insert:' + tmpFootno + ' ' + key + ' at ' + footnoteLocation);
                    //TODO: Add a BR node here instead of just a newline?
                    var node = editor.document.createTextNode('');
                    node.nodeValue = tmpFootno + ' ' + key + '\n';                   
                    editor.insertNode(node, parentNode, footnoteLocation);
                    //editor.insertNode(node, editor.rootElement, editor.rootElement.childNodes.length);
                } /*
                else 
                    { 
                    if(numFootnotes == 1)
                    {
                        editor.insertHTML('<ol>');
                    }
                    editor.insertHTML('<li>' + temp + '</li>');
                }*/
                //editor.insertNode(tempNode, editor.rootElement, nodes.length);
                //editor.rootElement.appendChild(newNode);
                }
            catch (e) 
            {
                //alert(e);
            }
        }
        editor.endOfDocument();
        // TODO: Close with </ol> if HTML editor
    },

    dump : function(str)
    {
        var csClass = Components.classes['@mozilla.org/consoleservice;1'];
        var cs = csClass.getService(Components.interfaces.nsIConsoleService);

        cs.logStringMessage((new Date()).getTime() + ': ' + str);
    },

};