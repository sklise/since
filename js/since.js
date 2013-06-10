$(function() {
  // Keep track of themes as defined in CSS. For the time being, there is a set
  // maximum to the theme counts, until I think of a way to accomodate changes
  // in counts that stay low, but also counts that get big.
  var themes = {
    'plant' : {
      title: 'plant',
      max: '7'
    }
  };

  // Return minimum of two values, for use with theme max count.
  Handlebars.registerHelper('min', function(v1, v2) {
    return Math.min(v1, v2);
  });

  Handlebars.registerHelper('dateText', function (date) {
    return moment(date).format("MMM Do, 'YY");
  });

  // http://stackoverflow.com/questions/1410285/calculating-the-difference-between-two-dates
  var datediff = function (start_time, end_time) {
    var d1 = (function () {
      if (typeof start_time === "Date") {
        return start_time.getTime();
      } else {
        return (new Date(start_time)).getTime();
      }
    }());
    var d2 = end_time.getTime();
    var oneday = 86400000;
    return (d2-d1) / oneday;
  }

  // Start FastClick to speed up clicks on iOS.
  FastClick.attach(document.body);

  var Item = Backbone.Model.extend({
    defaults: {
      "count": 0,
      "total" : 0,
      "resets" : 0,
      "started": new Date(),
      "theme" : "plant"
    },

    initialize: function (options) {
      // Set created_at and other defaults and id if new
      if (this.isNew()) {
        var now = new Date();
        this.set({
          'created_at': now,
          'id': now.getTime()
        });
      }
      this.set('theme_max', themes[this.get('theme')].max);
      this.set('count', this.makeCount());
    },

    makeCount: function () {
      var start = this.get('started');
      var now = new Date();
      return Math.floor(datediff(start, now));
    },

    restart: function () {
      var total = this.get('total');
      var count = this.get('count');
      var resets = this.get('resets');
      this.set({
        'total': total + count,
        'resets': resets + 1,
        'started': new Date(),
        'count': 0
      });
    }
  });

  var Items = Backbone.Collection.extend({
    model: Item,

    initialize: function () {
      this.on("change", this.synchronize, this);
      this.on("add", this.synchronize, this);
      this.on("remove", this.synchronize, this);
    },

    synchronize: function () {
      localStorage.info = JSON.stringify(this.toJSON());
    },

    sorted: function () {
      return this.sortBy(function(item) {
        return item.get('created_at');
      })
    }
  });


  var AppView = Backbone.View.extend({
    el: '#wrapper',
    initialize: function () {
      this.collection.bind('reset', this.render().el, this);
      var view = this;
      this.collection.on('change', this.render, this);
      this.collection.on('add', this.render, this);
      this.collection.on('remove', this.render, this);
    },

    events: {
      'click .add': 'new'
    },

    render: function () {
      var $v = this.$el;
      var view = this;
      var template = Handlebars.compile($('#app-template').html());
      $v.empty()
        .html(template())
        .hammer();
      var sorted = this.collection.sorted();
      _.forEach(sorted, function (model) {
        var iv = new ItemView({model: model});
        iv.on('restart', this.render);
        $v.find("#list").append(iv.render().el);
      });

      return this;
    },

    new: function () {
      var view = this;
      var $v = view.$el;
      $v.empty();
        var newView = new NewItemView({collection: view.collection});
        $v.append(newView.render().el);
        newView.on('canceled', view.render, view);
    }
  });

  var NewItemView = Backbone.View.extend({
    className: 'new-item',
    tagName: 'form',

    events: {
      'click .save' : 'make',
      'click .cancel' : 'cancel',
      'submit' : 'make'
    },

    cancel: function (event) {
      event.preventDefault();
      this.trigger('canceled');
    },

    make: function () {
      this.collection.add({title: this.$el.find('input[type=text]').val()});
      this.trigger('added');
    },

    render: function () {
      var template = Handlebars.compile($('#new-item-template').html());
      this.$el.empty();
      this.$el.html(template());
      return this;
    }
  });

  var ItemView = Backbone.View.extend({
    className: 'item-wrapper',

    initialize: function () {},

    events: {
      'dragleft' : 'dragging',
      'dragend' : 'dragEnd',
      'release' : 'release',
      'doubletap' : 'flip'
    },

    render: function () {
      var view = this;
      var template = Handlebars.compile($('#item-template').html());

      this.$el.html(template(this.model.toJSON()));
      this.$el.hammer();

      return this;
    },

    flip: function(event) {
      event.gesture.preventDefault();
      this.$el.toggleClass('show-back');
      this.$el.siblings().removeClass('show-back');
    },

    dragging: function (event) {
      event.gesture.preventDefault();

      if (this.$el.hasClass('show-back')) { return; }

      this.$el.addClass('dragging');
      var front = this.$el.find('.item-front');
      var item_width = front.width();
      var threshold = item_width * 3/8;

      front.css('left', event.gesture.deltaX+'px');
      this.$el.siblings().removeClass('show-back');

      if (event.gesture.deltaX * -1 > item_width * 7/8) {
        this.$el.addClass('destroy').removeClass('reset');
      } else {
        this.$el.removeClass('destroy');
      }

      if (event.gesture.deltaX * -1 > threshold) {
        this.$el.addClass('reset');
      } else {
        this.$el.removeClass('reset');
      }
    },

    dragEnd: function (event) {
      this.$el.find('.item-front').css('left','auto');

      if (this.$el.hasClass('destroy')) {
        this.model.collection.remove(this.model);
      } else if (this.$el.hasClass('reset')) {
        this.model.restart();
      }
    },

    release: function (event) {
      this.$el.removeClass('dragging');
      this.$el.find('.item-front').removeClass('reset');
      this.trigger('restart');
    }
  });

  if (localStorage.info === undefined) {
    // There is no data, generate a fake set of info, to kinda show how the
    // app works.
    today = new Date();
    var data = [];

    // Populate with the following counts
    _.each([0,1,2,3,4,6,10], function (i) {
      time = moment(today).subtract("days", i).toDate()
      data.push({
        title: "Plant " + i,
        created_at: time.getTime(),
        started: time,
        id: "" + time.getTime() + ""
      });
    });
  } else {
    var data = JSON.parse(localStorage.info);
  }

  window.appview = new AppView({collection: new Items(data)});
});