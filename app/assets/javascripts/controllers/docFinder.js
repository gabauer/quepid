'use strict';

angular.module('QuepidApp')
  .controller('DocFinderCtrl', [
    '$scope',
    'queriesSvc', 'settingsSvc',
    'solrExplainExtractorSvc', 'esExplainExtractorSvc',
    'rateBulkSvc',
    function (
      $scope,
      queriesSvc, settingsSvc,
      solrExplainExtractorSvc, esExplainExtractorSvc,
      rateBulkSvc
    ) {
      $scope.defaultList = false;
      $scope.docFinder = {
        docs:       [],
        lastQuery:  '',
        queryText:  '',
      };

      $scope.findDocs = function() {
        var settings      = settingsSvc.editableSettings();
        var query         = $scope.query.queryText;
        var ratingsStore  = $scope.query.ratingsStore;
        var fieldSpec     = settings.createFieldSpec();

        $scope.defaultList = false;

        $scope.docFinder.searcher = queriesSvc.createSearcherFromSettings(settings, query);

        $scope.docFinder.docs = []; // reset the array for a new search
        $scope.docFinder.searcher.explainOther($scope.docFinder.queryText, fieldSpec)
          .then(function() {
            $scope.docFinder.numFound   = $scope.docFinder.searcher.numFound;
            $scope.docFinder.lastQuery  = $scope.docFinder.queryText;

            var normalizedDocs;
            if ( $scope.docFinder.searcher.type === 'solr' ) {
              normalizedDocs = solrExplainExtractorSvc.docsWithExplainOther($scope.docFinder.searcher.docs, fieldSpec, $scope.docFinder.searcher.othersExplained);
            } else if ( $scope.docFinder.searcher.type === 'es' ) {
              normalizedDocs = esExplainExtractorSvc.docsWithExplainOther($scope.docFinder.searcher.docs, fieldSpec);
            }

            angular.forEach(normalizedDocs, function(doc) {
              var rateableDoc = ratingsStore.createRateableDoc(doc);
              $scope.docFinder.docs.push(rateableDoc);
            });
          });
      };

      $scope.paginate = function() {
        if($scope.defaultList) {
          $scope.paginateRatedQuery();
        } else {
          $scope.paginateCustomQuery();
        }
      };

      $scope.paginateCustomQuery = function() {
        if ( $scope.docFinder.searcher === null ) {
          return;
        }

        $scope.docFinder.searcher = $scope.docFinder.searcher.pager();
        $scope.docFinder.paging = true;

        if ( $scope.docFinder.searcher === null ) {
          $scope.docFinder.paging = false;
          return;
        }

        var settings      = settingsSvc.editableSettings();
        var fieldSpec     = settings.createFieldSpec();
        var ratingsStore  = $scope.query.ratingsStore;

        $scope.docFinder.searcher.explainOther($scope.docFinder.queryText, fieldSpec)
          .then(function() {
            $scope.docFinder.numFound   = $scope.docFinder.searcher.numFound;
            $scope.docFinder.lastQuery  = $scope.docFinder.queryText;

            var normalizedDocs;
            if ( $scope.docFinder.searcher.type === 'solr' ) {
              normalizedDocs = solrExplainExtractorSvc.docsWithExplainOther($scope.docFinder.searcher.docs, fieldSpec, $scope.docFinder.searcher.othersExplained);
            } else if ( $scope.docFinder.searcher.type === 'es' ) {
              normalizedDocs = esExplainExtractorSvc.docsWithExplainOther($scope.docFinder.searcher.docs, fieldSpec);
            }

            angular.forEach(normalizedDocs, function(doc) {
              var rateableDoc = ratingsStore.createRateableDoc(doc);
              $scope.docFinder.docs.push(rateableDoc);
            });

            $scope.docFinder.paging = false;
          });
      };

      $scope.paginateRatedQuery = function() {
        $scope.docFinder.searcher = $scope.docFinder.searcher.pager();
        $scope.docFinder.paging = true;

        if ( $scope.docFinder.searcher === null ) {
          $scope.docFinder.paging = false;
          return;
        }

        var settings      = settingsSvc.editableSettings();
        var fieldSpec     = settings.createFieldSpec();
        var ratedIDs = $scope.query.ratings ? Object.keys($scope.query.ratings) : [];

        $scope.docFinder.searcher.explainOther($scope.query.filterToRatings($scope.docFinder.searcher.type, fieldSpec), fieldSpec)
        .then(function() {
          var normed = queriesSvc.normalizeDocExplains($scope.query, $scope.docFinder.searcher, fieldSpec);

          angular.forEach(normed, function(doc) {
            var rateableDoc = $scope.query.ratingsStore.createRateableDoc(doc);
            $scope.docFinder.docs.push(rateableDoc);
          });
        });
      };


      var src = {
        'query':  $scope.query
      };

      $scope.ratings = { };

      $scope.$watch('query.effectiveScorer()', function() {
        rateBulkSvc.setScale(src, $scope.ratings);
      });

      rateBulkSvc.setScale(src, $scope.ratings);
      rateBulkSvc.handleRatingScale($scope.ratings,
        function(ratingNo) {
          var newRating = parseInt(ratingNo, 10);

          var ids = [];
          angular.forEach($scope.docFinder.docs, function(doc) {
            ids.push(doc.id);
          });

          if ( ids.length > 0 ) {
            $scope.docFinder.docs[0].rateBulk(ids, newRating);
          }
        },
        function() {
          var ids = [];
          angular.forEach($scope.docFinder.docs, function(doc) {
            ids.push(doc.id);
          });

          if ( ids.length > 0 ) {
            $scope.docFinder.docs[0].resetBulkRatings(ids);
          }
        },
        src
      );

      // Initialize to rated docs
      var currSettings = settingsSvc.editableSettings();


      var fieldSpec = currSettings.createFieldSpec();
      var ratedIDs = $scope.query.ratings ? Object.keys($scope.query.ratings) : [];
      $scope.docFinder.numFound = ratedIDs.length;

      $scope.docFinder.searcher = queriesSvc.createSearcherFromSettings(currSettings, $scope.query.queryText);

      if ($scope.docFinder.searcher.type === 'solr') {
        $scope.docFinder.searcher.explainOther($scope.query.filterToRatings($scope.docFinder.searcher.type, fieldSpec), fieldSpec)
          .then(function() {
            var normed = queriesSvc.normalizeDocExplains($scope.query, $scope.docFinder.searcher, fieldSpec);

            angular.forEach(normed, function(doc) {
              var rateableDoc = $scope.query.ratingsStore.createRateableDoc(doc);
              $scope.docFinder.docs.push(rateableDoc);
            });

            $scope.defaultList = true;
        });
      }
    }


  ]);
