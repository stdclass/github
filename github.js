// Github.js 0.2.0
// (c) 2012 Michael Aufreiter, Development Seed
// Github.js is freely distributable under the MIT license.
// For all details and documentation:
// http://substance.io/michael/github

(function() {
  
  var API_URL = 'https://api.github.com';
  
  var Github = function(options) {
    var username = options.username;
    var password = options.password;

    // Util
    // =======

    function _request(method, path, data, cb) {
      $.ajax({
          type: method,
          url: API_URL + path,
          data: JSON.stringify(data),
          dataType: 'json',
          contentType: 'application/x-www-form-urlencoded',
          success: function(res) { cb(null, res); },
          error: function(err) { cb(err); },
          headers : { Authorization : 'Basic ' + Base64.encode(username + ':' + password) }
      });
    }

    // USER API
    // =======

    Github.User = function() {
      this.repos = function(cb) {
        _request("GET", "/user/repos?type=all", null, function(err, res) {
          cb(err, res);
        });
      }
    };


    // Repository API
    // =======

    Github.Repository = function(options) {
      var repo = options.name;
      var branch = options.branch;
      var user = options.user;
      
      var that = this;
      var repoPath = "/repos/" + user + "/" + repo;

      // Get a particular reference
      // -------

      this.getRef = function(ref, cb) {
        _request("GET", repoPath + "/git/refs/heads/" + ref, null, function(err, res) {
          if (err) return cb(err);
          cb(null, res.object.sha);
        });
      };

      // List all branches of a repository
      // -------

      this.listBranches = function(cb) {
        _request("GET", repoPath + "/git/refs/heads", null, function(err, heads) {
          if (err) return cb(err);
          cb(null, _.map(heads, function(head) { return _.last(head.ref.split('/')); }));
        });
      };

      // Retrieve the contents of a blob
      // -------

      this.getBlob = function(sha, cb) {
        _request("GET", repoPath + "/git/blobs/" + sha, null, function(err, res) {
          cb(err, res);
        });
      };

      // Retrieve the tree a commit points to
      // -------

      this.getTree = function(commit, cb) {
        _request("GET", repoPath + "/git/trees/"+commit, null, function(err, res) {
          if (err) return cb(err);
          cb(null, res.sha);
        });
      };

      // Post a new blob object, getting a blob SHA back
      // -------

      this.postBlob = function(content, cb) {
        var data = {
          "content": content,
          "encoding": "utf-8"
        };
        _request("POST", repoPath + "/git/blobs", data, function(err, res) {
          if (err) return cb(err);
          cb(null, res.sha);
        });
      };

      // Post a new tree object having a file path pointer replaced
      // with a new blob SHA getting a tree SHA back
      // -------

      this.postTree = function(baseTree, path, blob, cb) {
        var data = {
          "base_tree": baseTree,
          "tree": [
            {
              "path": path,
              "mode": "100644",
              "type": "blob",
              "sha": blob
            }
          ]
        };
        _request("POST", repoPath + "/git/trees", data, function(err, res) {
          if (err) return cb(err);
          cb(null, res.sha);
        });
      };

      // Create a new commit object with the current commit SHA as the parent
      // and the new tree SHA, getting a commit SHA back
      // -------

      this.commit = function(parent, tree, message, cb) {
        var data = {
          "message": message,
          "author": {
            "name": username
          },
          "parents": [
            parent
          ],
          "tree": tree
        };

        _request("POST", repoPath + "/git/commits", data, function(err, res) {
          if (err) return cb(err);
          cb(null, res.sha);
        });
      };

      // Update the reference of your head to point to the new commit SHA
      // -------

      this.updateHead = function(head, commit, cb) {
        _request("PATCH", repoPath + "/git/refs/heads/" + head, { "sha": commit }, function(err, res) {
          cb(err);
        });
      };

      // Show repository information
      // -------

      this.show = function(cb) {
        _request("GET", repoPath, null, function(err, res) {
          cb();
        });
      };

      // List all files of a branch
      // -------

      this.list = function(branch, cb) {
        _request("GET", repoPath + "/git/trees/" + branch + "?recursive=1", null, function(err, res) {
          cb(err, res ? res.tree : null);
        });
      };


      // Read file at given path
      // -------

      this.read = function(branch, path, cb) {
        that.list(branch, function(err, tree) {
          var file = _.select(tree, function(file) {
            return file.path === path;
          })[0];

          if (!file) return cb("not found", null);

          that.getBlob(file.sha, function(err, blob) {
            function decode(blob) {
              if (blob.content) {
                var data = blob.encoding == 'base64' ?
                    atob(blob.content.replace(/\s/g, '')) :
                    blob.content;
                    
                return data;
              } else {
                return "";
              }
            }

            cb(null, decode(blob));
          });
        });
      };

      // Write file contents to a given branch and path
      // -------

      this.write = function(branch, path, content, message, cb) {
        that.getRef(branch, function(err, latestCommit) {
          that.getTree(latestCommit, function(err, tree) {
            that.postBlob(content, function(err, blob) {
              that.postTree(tree, path, blob, function(err, tree) {
                that.commit(latestCommit, tree, message, function(err, commit) {
                  that.updateHead(branch, commit, function(err) {
                    cb(err);
                  });
                });
              });
            });
          });
        });
      };
    };

    // Top Level API
    // -------

    this.getRepo = function(user, repo, branch) {
      return new Github.Repository({user: user, name: repo, branch: branch || "master"});
    };

    this.getUser = function() {
      return new Github.User();
    };
  };

  // Export the Github object for Node.js, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `Github` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== "undefined") {
    if (typeof module !== "undefined" && module.exports) {
      exports = module.exports = Github;
    }
    exports.Github = Github;
  } else {
    this['Github'] = Github;
  }
  
}).call(this);