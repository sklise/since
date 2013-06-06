// http://stackoverflow.com/questions/1410285/calculating-the-difference-between-two-dates
function datediff(start_time, end_time) {
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

$(function() {
  var Item = Backbone.Model.extend({
    defaults: {
      "count": 0,
      "total" : 0,
      "resets" : 0,
      "started": new Date()
    },

    initialize: function () {
      // Set created_at and other defaults and id if new
      if (this.isNew()) {
        var now = new Date();
        this.set({
          'created_at': now,
          'id': now.getTime()
        });
      }
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
    },

    synchronize: function () {
      console.log(this.toJSON());
      localStorage.info = JSON.stringify(this.toJSON());
    }
  });


  var AppView = Backbone.View.extend({
    el: '#list',
    initialize: function () {
      this.collection.bind('reset', this.render().el, this);
    },

    events: {
      'click .add': 'new'
    },

    new: function () {
      this.$el.empty();
      var newView = new NewItemView({collection: this.collection});

      this.$el.html(newView.render().el);
    },

    render: function () {
      this.$el.empty();
      this.collection.each(function (model) {
        var iv = new ItemView({model: model});
        iv.render().el;
      });
      this.$el.append('<div class="add">NEW</div></div>');
      return this;
    }
  });

  var NewItemView = Backbone.View.extend({
    className: 'new-item',

    events: {
      'click .save' : 'make'
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
      'dragleft' : 'restartCount',
      'dragend' : 'dragEnd',
      'release' : 'release'
    },

    render: function () {
      var view = this;
      var template = Handlebars.compile($('#item-template').html());

      $('#list').append(this.$el.html(template(this.model.toJSON())));
      this.$el.hammer();

      return this;
    },

    restartCount: function (event) {
      event.gesture.preventDefault();

      var front = this.$el.find('.item-front');
      var item_width = front.width();
      var threshold = item_width / 3;

      front.css('left', event.gesture.deltaX+'px');

      if (event.gesture.deltaX * -1 > threshold) {
        front.addClass('reset');
      }
    },

    dragEnd: function (event) {
      var front = this.$el.find('.item-front');

      if (front.hasClass('reset')) {
        this.model.restart();
      }

      this.$el.find('.item-front').css('left','auto');
    },

    release: function (event) {
      this.render().el;
    }
  });

  var ItemFrontView = Backbone.View.extend({});
  var ItemBackView = Backbone.View.extend({});

  window.since = {
    Item: Item,
    Items: Items,
    ItemView: ItemView,
    AppView: AppView
  }

  js = JSON.parse(localStorage.info);
  window.appview = new AppView({collection: new Items(js)});

  FastClick.attach(document.body);

  $('.item-wrapper').hammer().on("doubletap", function (event) {
    event.gesture.preventDefault();
    $(this).toggleClass('show-back');
    $(this).siblings().removeClass('show-back');
  });
});