var pnStartDelimiter = '[';
var pnEndDelimiter = ']';
var pnLiRegexpToken = '\\w+';
var pnLiArray = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];
var pnUrlPattern = /http:\/\/[^ \n]+[\w\/]/;
var pnNumberPattern = new RegExp('\\' + pnStartDelimiter + '(' + pnLiRegexpToken + ')' + '\\' + pnEndDelimiter);
var pnFootnotePattern = new RegExp('^\\s*' + pnNumberPattern.source + '\\s*' + '(' + pnUrlPattern.source + ')' + '\\s*$');

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

        var i = 0;
        var urlDict = {};
        editor.beginTransaction()
        urlDict = piednote.findExistingFootnotes(editor, nodes, urlDict);
        urlDict = piednote.parseText(editor, nodes, urlDict);
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
        var piednoteParent;
        var nodes;
        piednoteParent = editor.document.getElementById('piednoteParent');
        if (!piednoteParent) {
            return urlDict;
        }
        nodes = piednoteParent.childNodes;
        for (var i = 0; i < nodes.length; i++) {
            node = nodes[i];
            if (node.hasChildNodes()) {
                urlDict = piednote.findExistingFootnotes(editor, node.childNodes, urlDict);
            }
            else {
                try {
                    footnoteMatch = pnFootnotePattern.exec(node.nodeValue.toString());
                    var j = i;
                    while(footnoteMatch && j < nodes.length) {
                        //alert(node.nodeName + ':' + node.nodeValue.toString() + ':' + footnoteMatch);
                        //http://saladwithsteve.com/2008/02/javascript-undefined-vs-null.html
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
        var numFootnotes = dictSize(urlDict); //FIX: A more elegant way to avoid the predefined nodes
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
                            tmpLi = urlDict[urlMatch[0]];
                        }
                        else {
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
        var piednoteParent;
        //http://wolfram.kriesing.de/blog/index.php/2008/javascript-sort-object-by-a-value
        var sorted = [];
        for (var key in urlDict) {
            sorted.push([key, urlDict[key]]);
            sorted.sort(function (a, b) {return a[1] - b[1]});
        }
        
        if (sorted.length > 0) {
            piednoteParent = editor.document.getElementById('piednoteParent');
            if (!piednoteParent) {
                piednoteParent = editor.document.createElement('span');
                piednoteParent.id = 'piednoteParent';
                editor.insertNode(piednoteParent, editor.rootElement, nodes.length - 1);
            }
        }
        for (var i = 0; i < sorted.length; i++) {
            var key = sorted[i][0];
            var value = sorted[i][1];
            try {
                if( editorType == 'textmail' || editorType == 'text' )
                {  
                    var tmpFootno = pnStartDelimiter + value + pnEndDelimiter;
                    //alert('about to insert:' + tmpFootno + ' ' + key);
                    var node = editor.document.createTextNode('');
                    node.nodeValue = tmpFootno + ' ' + key;                   
                    piednoteParent.appendChild(node);
                    node = editor.document.createElement('br');
                    piednoteParent.appendChild(node);
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